import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
} from "h3";
import { discoverEaLibrary } from "../../../../utils/ea/library";
import { resolveDepotToken } from "../../../../utils/depot/connections";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  // Same token-acquisition model as the Epic library handler: caller-supplied
  // via query parameter or Authorization header first, then the connection
  // stored by an admin - the token is never kept here.
  let token =
    (typeof query.token === "string" ? query.token : undefined) ??
    getRequestHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    try {
      // Lazy import keeps the prisma-backed store out of the module graph
      // until a request actually needs a stored connection.
      const { prismaConnectionStore } =
        await import("../../../../utils/depot/connection-store");
      token = (await resolveDepotToken(prismaConnectionStore, "ea")).token;
    } catch (error) {
      // Expired stored connections say so directly; "no connection stored"
      // and an unreachable connection store both fall through to the
      // caller-token 401 below.
      if ((error as { statusCode?: number }).statusCode === 410) throw error;
    }
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "An EA access token is required",
    });
  }

  const title =
    typeof query.title === "string" ? query.title.trim() : undefined;
  const search =
    typeof query.search === "string" ? query.search.trim() : undefined;

  return discoverEaLibrary(token, { title, search });
});
