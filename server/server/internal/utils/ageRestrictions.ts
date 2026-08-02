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

  const allBanned = user.groups.flatMap((g) => g.bannedAgeRatings);
  if (allBanned.length === 0) return undefined;

  // Deduplicate across groups
  const seen = new Set<string>();
  const bannedPairs = allBanned.filter((bp) => {
    const key = `${bp.organization}:${bp.rating}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
