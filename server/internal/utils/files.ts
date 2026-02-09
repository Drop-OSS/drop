import fs from "node:fs";
import nodePath from "node:path";

export function fsStats(folderPath: string) {
  const stats = fs.statfsSync(folderPath);
  const freeSpace = stats.bavail * stats.bsize;
  const totalSpace = stats.blocks * stats.bsize;
  return { freeSpace, totalSpace };
}

export function getFolderSize(folderPath: string): number {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });

  const paths = files.map((file) => {
    const path = nodePath.join(folderPath, file.name);
    if (file.isDirectory()) {
      return getFolderSize(path);
    }
    if (file.isFile()) {
      return fs.statSync(path).size;
    }
    return 0;
  });

  return paths
    .flat(Infinity)
    .reduce(
      (accumulator: number, currentValue: number) => accumulator + currentValue,
      0,
    );
}

export function formatBytes(bytes: number): string {
  // TODO: use i18n formatting https://vue-i18n.intlify.dev/guide/essentials/number.html

  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes >= 1024 && bytes < Math.pow(1024, 2)) {
    return `${(bytes / 1024).toFixed(2)} KiB`;
  }
  if (bytes >= Math.pow(1024, 2) && bytes < Math.pow(1024, 3)) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }
  if (bytes >= Math.pow(1024, 3) && bytes < Math.pow(1024, 4)) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  }
  return `${(bytes / Math.pow(1024, 4)).toFixed(2)} TiB`;
}
