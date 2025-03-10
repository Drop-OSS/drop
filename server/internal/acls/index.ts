import { APITokenMode, User } from "@prisma/client";
import { H3Context, H3Event } from "h3";
import prisma from "../db/database";
import sessionHandler from "../session";
import { MinimumRequestObject } from "~/server/h3";

export const userACLs = [
  "read",

  "store:read",

  "object:read",
  "object:update",
  "object:delete",

  "notifications:read",
  "notifications:mark",
  "notifications:listen",
  "notifications:delete",

  "collections:new",
  "collections:read",
  "collections:delete",
  "collections:add",
  "collections:remove",
  "library:add",
  "library:remove",

  "news:read",
] as const;
const userACLPrefix = "user:";

type UserACL = Array<(typeof userACLs)[number]>;

export const systemACLs = [
  "auth:simple:invitation:read",
  "auth:simple:invitation:new",
  "auth:simple:invitation:delete",

  "library:read",
  "game:read",
  "game:update",
  "game:delete",
  "game:version:update",
  "game:version:delete",
  "game:image:new",
  "game:image:delete",

  "import:version:read",
  "import:version:new",

  "import:game:read",
  "import:game:new",

  "user:read",

  "news:read",
  "news:create",
  "news:delete",
] as const;
const systemACLPrefix = "system:";

type SystemACL = Array<(typeof systemACLs)[number]>;

class ACLManager {
  private getAuthorizationToken(request: MinimumRequestObject) {
    const [type, token] =
      request.headers.get("Authorization")?.split(" ") ?? [];
    if (!type || !token) return undefined;
    if (type != "Bearer") return undefined;
    return token;
  }

  async getUserIdACL(request: MinimumRequestObject | undefined, acls: UserACL) {
    if (!request)
      throw new Error("Native web requests not available - weird deployment?");
    // Sessions automatically have all ACLs
    const userId = await sessionHandler.getUserId(request);
    if (userId) return userId;

    const authorizationToken = this.getAuthorizationToken(request);
    if (!authorizationToken) return undefined;
    const token = await prisma.aPIToken.findUnique({
      where: { token: authorizationToken },
    });
    if (!token) return undefined;
    if (token.mode != APITokenMode.User || !token.userId) return undefined; // If it's a system token

    for (const acl of acls) {
      const tokenACLIndex = token.acls.findIndex((e) => e == acl);
      if (tokenACLIndex != -1) return token.userId;
    }

    return undefined;
  }

  async getUserACL(request: MinimumRequestObject | undefined, acls: UserACL) {
    if (!request)
      throw new Error("Native web requests not available - weird deployment?");
    const userId = await this.getUserIdACL(request, acls);
    if (!userId) return undefined;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user;
    return undefined;
  }

  async allowSystemACL(
    request: MinimumRequestObject | undefined,
    acls: SystemACL
  ) {
    if (!request)
      throw new Error("Native web requests not available - weird deployment?");
    const userId = await sessionHandler.getUserId(request);
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return false;
      if (user.admin) return true;
      return false;
    }

    const authorizationToken = this.getAuthorizationToken(request);
    if (!authorizationToken) return false;
    const token = await prisma.aPIToken.findUnique({
      where: { token: authorizationToken },
    });
    if (!token) return false;
    if (token.mode != APITokenMode.System) return false;
    for (const acl of acls) {
      const tokenACLIndex = token.acls.findIndex((e) => e == acl);
      if (tokenACLIndex != -1) return true;
    }

    return false;
  }

  async hasACL(request: MinimumRequestObject | undefined, acls: string[]) {
    for (const acl of acls) {
      if (acl.startsWith(userACLPrefix)) {
        const rawACL = acl.substring(userACLPrefix.length);
        const userId = await this.getUserIdACL(request, [rawACL as any]);
        if (!userId) return false;
      }

      if (acl.startsWith(systemACLPrefix)) {
        const rawACL = acl.substring(systemACLPrefix.length);
        const allowed = await this.allowSystemACL(request, [rawACL as any]);
        if (!allowed) return false;
      }
    }

    return true;
  }
}

export const aclManager = new ACLManager();
export default aclManager;
