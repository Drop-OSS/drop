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

/**
 * Leaves out games carrying any tag the user chose to hide. Applies to admins
 * too: it's the user's own preference, not a restriction placed on them.
 */
export async function getHiddenTagFilter(
  userId: string,
): Promise<Prisma.GameWhereInput | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hiddenTags: { select: { id: true } } },
  });
  const ids = user?.hiddenTags.map((t) => t.id) ?? [];
  if (ids.length === 0) return undefined;
  return { tags: { none: { id: { in: ids } } } };
}

/**
 * Everything that decides whether a game shows up in a user's game lists:
 * their groups' banned age ratings and their own hidden tags. Wrapped in AND
 * so it can be spread next to other filters without overwriting their keys.
 */
export async function getGameVisibilityFilter(
  userId: string,
  isAdmin: boolean,
): Promise<Prisma.GameWhereInput | undefined> {
  const filters = [
    await getAgeRestrictionFilter(userId, isAdmin),
    await getHiddenTagFilter(userId),
  ].filter((f) => f !== undefined);
  if (filters.length === 0) return undefined;
  return { AND: filters };
}
