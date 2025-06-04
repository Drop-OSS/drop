import path from "path";
import module from "module";
import fs from "fs/promises";
import sanitize from "sanitize-filename";

import aclManager from "~/server/internal/acls";

const twemojiJson = module.findPackageJSON(
  "@discordapp/twemoji",
  import.meta.url,
);

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["object:read"]);
  if (!userId)
    throw createError({
      statusCode: 403,
    });

  if (!twemojiJson)
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to resolve emoji package",
    });

  const unsafeId = getRouterParam(h3, "id");
  if (!unsafeId)
    throw createError({ statusCode: 400, statusMessage: "Invalid ID" });

  const svgPath = path.join(
    path.dirname(twemojiJson),
    "dist",
    "svg",
    sanitize(unsafeId),
  );

  setHeader(
    h3,
    "Cache-Control",
    // 7 days
    "public, max-age=604800, s-maxage=604800",
  );
  setHeader(h3, "Content-Type", "image/svg+xml");
  return await fs.readFile(svgPath);
});
