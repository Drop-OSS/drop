import type { Prisma } from "~/prisma/client/client";
import prisma from "~/server/internal/db/database";

export async function getAgeRestrictionFilter(
  userId: string,
  isAdmin: boolean,
): Promise<Prisma.GameWhereInput | undefined> {
  if (isAdmin) return undefined;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      groups: {
        select: {
          bannedAgeRatings: {
            select: {
              organization: true,
              rating: true,
            },
          },
        },
      },
    },
  });

  if (!user) return undefined;

  const bannedPairs = user.groups.flatMap((g) => g.bannedAgeRatings);
  if (bannedPairs.length === 0) return undefined;

  return {
    AND: [
      { ageRatings: { some: {} } },
      {
        NOT: {
          ageRatings: {
            some: {
              OR: bannedPairs.map((bp) => ({
                organization: bp.organization,
                rating: bp.rating,
              })),
            },
          },
        },
      },
    ],
  };
}
