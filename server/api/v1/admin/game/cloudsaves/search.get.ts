/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-extra-non-null-assertion */

import type { LudusaviEntry } from "~/prisma/client";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:cloudsaves:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const query = getQuery(h3);
  const name = query.name?.toString()!!;

  // Remove all non alphanumberical characters
  const sanatisedName = name.replaceAll(/[^a-zA-Z\d\s:]/g, "");

  const results = await prisma.$queryRaw`SELECT * FROM "LudusaviEntry" ORDER BY SIMILARITY(name, ${sanatisedName}) DESC LIMIT 20;`;

  return results as Array<LudusaviEntry>;
});
