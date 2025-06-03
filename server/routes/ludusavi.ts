/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */

import prisma from "../internal/db/database";
import { parsePlatform } from "../internal/utils/parseplatform";
import tsquery from "pg-tsquery";

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const name = query.name?.toString()!!;
  const platform = parsePlatform(query.platform?.toString()!!)!!;

  const parser = tsquery({});

  return await prisma.ludusaviEntry.findMany({
    orderBy: {
      _relevance: {
        fields: ["name"],
        search: parser(name),
        sort: "desc",
      },
    },
    include: {
      entries: {
        where: {
          platform,
        },
      },
    },
    take: 20,
  });
});
