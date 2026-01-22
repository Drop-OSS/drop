import { ArkErrors, type } from "arktype";
import { GameType } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import type { GameMetadataSearchResult } from "~/server/internal/metadata/types";

const Query = type({
  q: "string",
  type: type.valueOf(GameType).optional(),
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "game:read",
    "depot:read",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const results: {
    id: string;
    mName: string;
    mIconObjectId: string;
    mShortDescription: string;
    mReleased: string;
  }[] =
    await prisma.$queryRaw`SELECT id, "mName", "mIconObjectId", "mShortDescription", "mReleased" FROM "Game" WHERE SIMILARITY("mName", ${query.q}) > 0.2 AND (${query.type || "undefined"} = 'undefined' OR type::text = ${query.type}) ORDER BY SIMILARITY("mName", ${query.q}) DESC;`;

  const resultsMapped = results.map(
    (v) =>
      ({
        id: v.id,
        name: v.mName,
        icon: v.mIconObjectId,
        description: v.mShortDescription,
        year: new Date(v.mReleased).getFullYear(),
      }) satisfies GameMetadataSearchResult,
  );

  return resultsMapped;
});
