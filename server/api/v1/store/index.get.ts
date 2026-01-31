import { ArkErrors, type } from "arktype";
import type { Prisma } from "~/prisma/client/client";
import { GameType } from "~/prisma/client/enums";
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
  platform: "string?",

  company: "string?",
  companyActions: "string = 'published,developed'",

  sort: "'default' | 'newest' | 'recent' | 'name' = 'default'",
  order: "'asc' | 'desc' = 'desc'",
});

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["store:read"]);
  if (!userId) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const options = StoreRead(query);
  if (options instanceof ArkErrors)
    throw createError({ statusCode: 400, statusMessage: options.summary });

  const filterPlatforms = options.platform
    ?.split(",")
    .map(parsePlatform)
    .filter((e) => e !== undefined);

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
  const platformFilter = filterPlatforms
    ? ({
        versions: {
          some: {
            launches: {
              some: {
                platform: {
                  in: filterPlatforms,
                },
              },
            },
            setups: {
              some: {
                platform: {
                  in: filterPlatforms,
                },
              },
            },
          },
        },
      } satisfies Prisma.GameWhereInput)
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
    ...platformFilter,
    ...companyFilter,
    type: GameType.Game,
  };

  const sort: Prisma.GameOrderByWithRelationInput = {};
  switch (options.sort) {
    case "default":
    case "newest":
      sort.mReleased = options.order;
      break;
    case "recent":
      sort.created = options.order;
      break;
    case "name":
      sort.mName = options.order;
      break;
  }

  const [results, count] = await prisma.$transaction([
    prisma.game.findMany({
      skip: options.skip,
      take: Math.min(options.take, 50),
      where: finalFilter,
      orderBy: sort,
    }),
    prisma.game.count({ where: finalFilter }),
  ]);

  return { results, count };
});
