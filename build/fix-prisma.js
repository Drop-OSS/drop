// thanks https://github.com/prisma/prisma/issues/26565#issuecomment-2777915354

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

async function replaceInFiles(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    // Skip directories
    if (!file.isDirectory()) {
      if (
        file.name.endsWith(".js") ||
        file.name.endsWith(".ts") ||
        file.name.endsWith(".mjs")
      ) {
        let content = await fs.readFile(fullPath, "utf8");
        if (content.includes(".prisma")) {
          const isWindows = content.includes("\r\n");
          const lineEnding = isWindows ? "\r\n" : "\n";

          content = content
            .split(/\r?\n/)
            .map((line) => line.replace(/\.prisma/g, "_prisma"))
            .join(lineEnding);

          await fs.writeFile(fullPath, content, "utf8");
          console.log(`Modified: ${fullPath}`);
        }
      }
    }
  }
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const oldPath = path.join(__dirname, "../node_modules/.prisma");
  const newPath = path.join(__dirname, "../node_modules/_prisma");
  try {
    await fs.rename(oldPath, newPath);
    console.log("Directory renamed from .prisma to _prisma");
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    console.log("Directory .prisma does not exist or has already been renamed");
  }

  await replaceInFiles(path.join(__dirname, "../node_modules/@prisma/client"));
  console.log("Done! --- prisma!!!, replaced .prisma with _prisma");
}

main().catch((err) => console.error(err));
