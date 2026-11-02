import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
} from "h3";
import { getGogLibrary } from "../../../../utils/gog";
import { resolveDepotToken } from "../../../../utils/depot/connections";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  let token =
    (typeof query.token === "string" ? query.token : undefined) ??
    getRequestHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");
  let connectionId: string | undefined;
  if (!token) {
    try {
      // Lazy import: keeps the prisma-backed store out of the module graph
      // until a request actually needs a stored connection.
      const { prismaConnectionStore } =
        await import("../../../../utils/depot/connection-store");
      const resolved = await resolveDepotToken(prismaConnectionStore, "gog");
      token = resolved.token;
      connectionId = resolved.connectionId;
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
      statusMessage: "A GOG access token is required",
    });
  }

  let games;
  try {
    games = await getGogLibrary(token);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage:
        statusCode === 401 || statusCode === 403
          ? "GOG rejected the access token"
          : "Unable to retrieve the GOG library",
    });
  }

  // Cache the listing for the stored connection so the library survives
  // token expiry and can show what is already local. Best-effort: a cache
  // write failure never fails the live listing the caller asked for.
  if (connectionId) {
    try {
      const { recordStoreManifests } =
        await import("../../../../utils/depot/connection-store");
      await recordStoreManifests(
        connectionId,
        games.map((game) => ({
          externalGameId: String(game.id),
          title: game.title,
          image:
            typeof game.image === "string"
              ? game.image
              : typeof game.coverVertical === "string"
                ? game.coverVertical
                : undefined,
          payload: game,
        })),
      );
    } catch {
      // Swallowed deliberately: the caller gets the fresh listing regardless.
    }
  }

  const title =
    typeof query.title === "string"
      ? query.title.trim().toLocaleLowerCase()
      : "";
  const os =
    typeof query.os === "string" ? query.os.trim().toLocaleLowerCase() : "";
  const filtered = games.filter((game) => {
    const titleMatches =
      !title || game.title.toLocaleLowerCase().includes(title);
    const supported = game.worksOn ?? game.platforms ?? [];
    const osMatches =
      !os ||
      supported.some((platform) => platform.toLocaleLowerCase().includes(os));
    return titleMatches && osMatches;
  });

  return { games: filtered, total: filtered.length };
});
