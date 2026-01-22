import prisma from "~/server/internal/db/database";
import { depotAuthorization } from "./manifest.get";

export default defineEventHandler(async (h3) => {
  await depotAuthorization(h3);

  const games = await prisma.game.findMany({
    select: {
      id: true,
      versions: {
        select: {
          versionId: true,
        },
        where: {
          versionPath: {
            not: null
          }
        }
      },
    },
  });

  return games;
});
