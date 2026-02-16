import { ArkErrors, type } from "arktype";
import type { SerializeObject } from "nitropack";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

const Query = type({
  q: "string?",
  s: "string.numeric.parse?",
  l: "string.numeric.parse?",
});

type FetchArg = Parameters<typeof libraryManager.fetchGamesWithStatus>[0];

export type AdminLibraryGame = SerializeObject<
  Awaited<ReturnType<typeof libraryManager.fetchGamesWithStatus>>[number]
>;

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["library:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const skip = query.s
    ? ({
        skip: query.s,
      } satisfies FetchArg)
    : undefined;

  const limit = Math.min(query.l ?? 24, 50);

  const results = await libraryManager.fetchGamesWithStatus({
    ...skip,
    take: limit,
  });

  const count = await prisma.game.count();

  return { results, count };
});
