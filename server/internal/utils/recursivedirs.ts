import fs from "fs";
import path from "path";

export function recursivelyReaddir(dir: string, depth: number = 100) {
  if (depth == 0) return [];
  const result: Array<string> = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const targetDir = path.join(dir, file);
    const stat = fs.lstatSync(targetDir);
    if (stat.isDirectory()) {
      const subdirs = recursivelyReaddir(targetDir, depth - 1);
      const subdirsWithBase = subdirs.map((e) => path.join(dir, e));
      result.push(...subdirsWithBase);
      continue;
    }
    result.push(targetDir);
  }

  return result;
}
