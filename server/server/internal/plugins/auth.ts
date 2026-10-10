import jwt from "jsonwebtoken";
import type { MinimumRequestObject } from "~/server/h3";

export type PluginAuthContext = {
  userId?: string;
  userAcls?: string[];
};

const JWT_TIME_WIGGLE = 30_000;

export type ClientJwtDeps = {
  fetchCertificate: (
    clientId: string,
  ) => Promise<{ cert: string } | undefined | null>;
  fetchUser: (
    userId: string,
  ) => Promise<{ id: string; admin: boolean } | undefined | null>;
};

/**
 * Parses the desktop client `Authorization: JWT <clientId> <jwt>` header.
 * Returns undefined for any other scheme or malformed value.
 */
export function parseClientJwtHeader(
  header: string | null | undefined,
): { clientId: string; token: string } | undefined {
  if (!header) return undefined;
  const [method, clientId, token] = header.split(" ");
  if (method !== "JWT" || !clientId || !token) return undefined;
  return { clientId, token };
}

/**
 * Resolves the authenticated user from a desktop client JWT, matching the
 * semantics of `defineClientEventHandler` (certificate lookup, blacklist
 * check, ES384 verification).
 */
export async function resolveClientJwt(
  request: MinimumRequestObject,
  deps?: ClientJwtDeps,
): Promise<string | undefined> {
  const parsed = parseClientJwtHeader(request.headers.get("Authorization"));
  if (!parsed) return undefined;

  const effectiveDeps = deps ?? (await defaultClientJwtDeps());
  const certBundle = await effectiveDeps.fetchCertificate(parsed.clientId);
  if (!certBundle) return undefined;

  try {
    jwt.verify(parsed.token, certBundle.cert, {
      clockTolerance: JWT_TIME_WIGGLE,
    });
  } catch {
    return undefined;
  }

  const client = await effectiveDeps.fetchUser(parsed.clientId);
  return client?.id;
}

async function defaultClientJwtDeps(): Promise<ClientJwtDeps> {
  const { useCertificateAuthority } = await import("../../plugins/ca");
  const { default: prisma } = await import("../db/database");

  return {
    fetchCertificate: async (clientId) => {
      const certificateAuthority = useCertificateAuthority();
      return await certificateAuthority.fetchClientCertificate(clientId);
    },
    // The client JWT identifies a client; the client is owned by a user.
    fetchUser: async (clientId) => {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { user: { select: { id: true, admin: true } } },
      });
      return client?.user;
    },
  };
}

/**
 * Resolves plugin route/WS identity. Session cookies and `Bearer` API tokens
 * are handled by the ACL manager; desktop clients authenticate with the
 * `JWT` scheme instead.
 */
export async function resolvePluginAuth(
  request: MinimumRequestObject,
): Promise<PluginAuthContext> {
  const { default: aclManager } = await import("../acls");

  // `getUserIdACL(..., [])` resolves sessions only; Bearer API tokens are
  // resolved separately so a valid token authenticates plugin routes/WS (the
  // previous empty-ACL call silently rejected every Bearer token).
  const sessionUserId =
    (await aclManager.getUserIdACL(request, [])) ??
    (await aclManager.getUserIdFromBearer(request));
  if (sessionUserId) {
    const allAcls = await aclManager.fetchAllACLs(request);
    return {
      userId: sessionUserId,
      userAcls: allAcls ? Array.from(allAcls) : undefined,
    };
  }

  const jwtUserId = await resolveClientJwt(request);
  if (!jwtUserId) return {};

  const { default: prisma } = await import("../db/database");
  const { userACLs, systemACLs } = await import("../acls");
  const user = await prisma.user.findUnique({ where: { id: jwtUserId } });
  if (!user) return {};

  const acls: string[] = userACLs.map((acl) => `user:${acl}`);
  if (user.admin) {
    acls.push(...systemACLs.map((acl) => `system:${acl}`));
  }

  return { userId: jwtUserId, userAcls: acls };
}
