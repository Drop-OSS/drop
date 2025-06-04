import path from "path";
import module from "module";
import fs from "fs/promises";
import sanitize from "sanitize-filename";

// // Get current file path (for ESM)
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const require = createRequire(import.meta.url);
// const nodeModulesPath = path.dirname(require.resolve("lodash/package.json"));

const twemojiJson = module.findPackageJSON(
  "@discordapp/twemoji",
  import.meta.url,
);

export default defineEventHandler(async (h3) => {
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

  setHeader(h3, "Content-Type", "image/svg+xml");
  return await fs.readFile(svgPath);
});
