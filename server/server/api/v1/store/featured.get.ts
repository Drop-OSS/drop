import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { getAgeRestrictionFilter } from "~/server/internal/utils/ageRestrictions";

export default defineEventHandler(async (h3) => {
  const user = await aclManager.getUserACL(h3, ["store:read"]);
  if (!user) throw createError({ statusCode: 403 });

  const ageFilter = await getAgeRestrictionFilter(user.id, user.admin);

  const games = await prisma.game.findMany({
    where: {
      featured: true,
      ...ageFilter,
    },
    select: {
      id: true,
      mName: true,
      mShortDescription: true,
      mCoverObjectId: true,
      mBannerObjectId: true,
      developers: {
        select: {
          id: true,
          mName: true,
        },
      },
      publishers: {
        select: {
          id: true,
          mName: true,
        },
      },
    },
    orderBy: {
      created: "desc",
    },
  });

  return games;
});
