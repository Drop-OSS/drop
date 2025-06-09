import { ArkErrors } from "arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { StoreComponentSource } from "~/server/internal/store/types";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const rawQuery = getQuery(h3);
  const query = StoreComponentSource(rawQuery);
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: query.summary });

  const amount = rawQuery.amount ? parseInt(rawQuery.amount.toString()) : 12;

  switch (query.name) {
    case "newlyAdded":
      return await prisma.game.findMany({ take: amount });
    case "newlyReleased":
      return await prisma.game.findMany({
        orderBy: { mReleased: "desc" },
        take: amount,
      });
    case "newlyUpdated":
      return (
        await prisma.gameVersion.findMany({
          where: {
            versionIndex: {
              gte: 1,
            },
          },
          select: {
            game: true,
          },
          orderBy: {
            created: "desc",
          },
          take: amount,
        })
      )
        .map((e) => e.game)
        .filter(
          (thing, i, arr) => arr.findIndex((t) => t.id === thing.id) === i,
        );
    case "companies":
      return await prisma.company.findMany({ take: amount });
  }

  return [];
});
