import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
} from "h3";
import { getUbisoftOwnedTitles } from "../../../../utils/ubisoft/client";
import { resolveDepotToken } from "../../../../utils/depot/connections";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  // Ubisoft session tickets travel as `Ubi_v1 t=<ticket>`; accept that or a
  // plain Bearer token, but never log the ticket value.
  const rawAuth = getRequestHeader(event, "authorization") ?? "";
  let ticket = (
    rawAuth.startsWith("Ubi_v1 ") ? rawAuth.slice("Ubi_v1 ".length) : rawAuth
  )
    .replace(/^t=/, "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!ticket) {
    try {
      // Lazy import keeps the prisma-backed store out of the module graph
      // until a request actually needs a stored connection.
      const { prismaConnectionStore } =
        await import("../../../../utils/depot/connection-store");
      const resolved = await resolveDepotToken(
        prismaConnectionStore,
        "ubisoft",
      );
      ticket = resolved.token;
    } catch (error) {
      // Expired stored connections say so directly; everything else falls
      // through to the caller-credential checks below.
      if ((error as { statusCode?: number }).statusCode === 410) throw error;
    }
  }

  if (!ticket) {
    throw createError({
      statusCode: 401,
      statusMessage: "A Ubisoft Connect session ticket is required",
    });
  }

  let ownedTitles;
  try {
    ownedTitles = await getUbisoftOwnedTitles(ticket);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage:
        statusCode === 401 || statusCode === 403
          ? "Ubisoft Connect rejected the session ticket"
          : "Unable to retrieve Ubisoft owned titles",
    });
  }

  // The gateway's Game nodes carry the product names directly; the old
  // api-uplayv2 configuration service (names by spaceId) no longer resolves.
  const title =
    typeof query.title === "string"
      ? query.title.trim().toLocaleLowerCase()
      : "";
  const games = ownedTitles
    .filter(
      (g) =>
        !title || (g.name || g.spaceId).toLocaleLowerCase().includes(title),
    )
    .map((g) => ({
      spaceId: g.spaceId,
      name: g.name ?? "",
      releaseDate: g.releaseDate,
    }));

  return { games, total: games.length };
});
