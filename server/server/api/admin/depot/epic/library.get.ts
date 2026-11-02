import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
} from "h3";
import aclManager from "~/server/internal/acls";
import { getEpicEntitlements } from "../../../../utils/epic/client";
import { resolveDepotToken } from "../../../../utils/depot/connections";

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:read"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
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

  const title =
    typeof query.title === "string"
      ? query.title.trim().toLocaleLowerCase()
      : "";
  const filtered = entitlements.filter((item) => {
    // Epic entitlements carry `entitlementName`, not a display `title`.
    const titleMatches =
      !title || item.entitlementName.toLocaleLowerCase().includes(title);
    return titleMatches;
  });

  return { games: filtered, total: filtered.length };
});
