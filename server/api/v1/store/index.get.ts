import { ArkErrors, type } from "arktype";
import type { Genre, Prisma } from "~/prisma/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

const StoreRead = type({
  skip: type("string")
    .pipe((s) => Number.parseInt(s))
    .default("0"),
  take: type("string")
    .pipe((s) => Number.parseInt(s))
    .default("10"),

  tags: "string?",
  genres: "string?",
  platform: "string?",

  company: "string?",
  companyActions: "string = 'published,developed'",

  sort: "'newest' | 'recent' = 'newest'",
});

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const options = StoreRead(query);
  if (options instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: options.summary });

  /**
   * Generic filters
   */
  const tagFilter = options.tags
    ? {
        tags: {
          some: {
            id: {
              in: options.tags.split(","),
            },
          },
        },
      }
    : undefined;
  const genreFilter = options.genres
    ? {
        genres: {
          hasSome: options.genres.split(",") as Array<Genre>,
        },
      }
    : undefined;
  const platformFilter = options.platform
    ? {
        versions: {
          some: {
            platform: {
              in: options.platform
                .split(",")
                .map(parsePlatform)
                .filter((e) => e !== undefined),
            },
          },
        },
      }
    : undefined;

  /**
   * Company filtering
   */
  const companyActions = options.companyActions.split(",");
  const developedFilter = companyActions.includes("developed")
    ? {
        developers: {
          some: {
            id: options.company!,
          },
        },
      }
    : undefined;
  const publishedFilter = companyActions.includes("published")
    ? {
        publishers: {
          some: {
            id: options.company!,
          },
        },
      }
    : undefined;
  const companyFilter = options.company
    ? ({
        OR: [developedFilter, publishedFilter].filter((e) => e !== undefined),
      } satisfies Prisma.GameWhereInput)
    : undefined;

  /**
   * Query
   */

  const finalFilter: Prisma.GameWhereInput = {
    ...tagFilter,
    ...genreFilter,
    ...platformFilter,
    ...companyFilter,
  };

  const sort: Prisma.GameOrderByWithRelationInput = {};
  switch (options.sort) {
    case "newest":
      sort.mReleased = "desc";
      break;
    case "recent":
      sort.created = "desc";
      break;
  }

  const results = await prisma.game.findMany({
    skip: options.skip,
    take: Math.min(options.take, 50),
    where: finalFilter,
    orderBy: {
      mReleased: "desc",
    },
  });

  return results;
});
