import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
  type H3Event,
} from "h3";
import {
  collectEpicCatalogNameTargets,
  getEpicCatalogItemNames,
  getEpicEntitlements,
  getEpicLibraryItems,
  listableEpicLibraryItems,
  normalizeEpicEntitlements,
  normalizeEpicLibraryItems,
  type EpicLibraryRow,
} from "../../../../utils/epic/client";
import { resolveDepotToken } from "../../../../utils/depot/connections";

/** Exported unauthenticated for hermetic tests; the route gates with ACLs. */
export async function epicLibraryHandler(event: H3Event) {
  const query = getQuery(event);
  let token =
    (typeof query.token === "string" ? query.token : undefined) ??
    getRequestHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");

  // Epic scopes entitlements to an account ID, which is not derivable from the
  // bearer token; callers must supply it (same shape as the Ubisoft handler's
  // required `userId`) unless a stored connection provides it.
  let accountId =
    typeof query.accountId === "string" ? query.accountId.trim() : "";
  if (!token) {
    try {
      // Lazy import keeps the prisma-backed store out of the module graph
      // until a request actually needs a stored connection.
      const { prismaConnectionStore } =
        await import("../../../../utils/depot/connection-store");
      const resolved = await resolveDepotToken(prismaConnectionStore, "epic");
      token = resolved.token;
      if (!accountId) accountId = resolved.accountId ?? "";
    } catch (error) {
      // Expired stored connections say so directly; everything else falls
      // through to the caller-token checks below.
      if ((error as { statusCode?: number }).statusCode === 410) throw error;
    }
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "An Epic Games access token is required",
    });
  }

  if (!accountId) {
    throw createError({
      statusCode: 400,
      statusMessage: "An Epic accountId query parameter is required",
    });
  }

  let rows: EpicLibraryRow[];
  try {
    // Primary source: Epic's curated product list - what the launcher's
    // Library tab shows. One record per product, with the real install
    // appName and a human sandboxName; the audience-grant hashing the
    // entitlement endpoint wallows in simply never appears here.
    const items = listableEpicLibraryItems(await getEpicLibraryItems(token));
    const catalogNames = await getEpicCatalogItemNames(
      collectEpicCatalogNameTargets(items),
      token,
    );
    rows = normalizeEpicLibraryItems(items, catalogNames);
  } catch {
    // Fallback: the raw entitlement grants. Same catalog naming pass;
    // AUDIENCE giveaways show under Epic's grant spellings here, which is
    // strictly still better than the hash. A dead token fails here too,
    // and that error - not the library one - is what the admin sees.
    let entitlements;
    try {
      entitlements = await getEpicEntitlements(accountId, token);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      throw createError({
        statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
        statusMessage:
          statusCode === 401 || statusCode === 403
            ? "Epic Games rejected the access token"
            : "Unable to retrieve Epic Games entitlements",
      });
    }
    // Epic entitlements come back nameless, period (live-verified: displayName
    // null for every row); resolve what we can from the catalog service.
    // Tolerant by design - whatever Epic refuses to answer keeps its
    // fallback title rather than failing the library.
    const catalogNames = await getEpicCatalogItemNames(
      collectEpicCatalogNameTargets(entitlements),
      token,
    );
    rows = normalizeEpicEntitlements(entitlements, catalogNames);
  }

  const title =
    typeof query.title === "string"
      ? query.title.trim().toLocaleLowerCase()
      : "";
  const filtered = rows.filter(
    (row) => !title || row.title.toLocaleLowerCase().includes(title),
  );

  return { games: filtered, total: filtered.length };
}

export default defineEventHandler(async (event) => {
  // Lazy import keeps the session/prisma module graph out of hermetic tests
  // of the library logic (epicLibraryHandler), as in the EA handler.
  const { default: aclManager } = await import("~/server/internal/acls");
  if (!(await aclManager.allowSystemACL(event, ["depot:read"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  return epicLibraryHandler(event);
});
