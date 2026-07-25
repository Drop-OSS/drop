import fs from "node:fs";
import nodePath from "node:path";

export function fsStats(folderPath: string) {
  const stats = fs.statfsSync(folderPath);
  const freeSpace = stats.bavail * stats.bsize;
  const totalSpace = stats.blocks * stats.bsize;
  return { freeSpace, totalSpace };
}

/**
 * Calculates the total size of all files within a directory and its subdirectories.
 *
 * @param folderPath - The path to the directory to measure
 * @returns The total size of the directory contents in bytes
 */
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

/**
 * Formats a byte count as a human-readable binary unit.
 *
 * @param bytes - The number of bytes to format
 * @returns The byte count expressed in B, KiB, MiB, GiB, or TiB
 */
export function formatBytes(bytes: number): string {
  // PENDING(sonar): use i18n number formatting for bytes display - deferred, needs vue-i18n integration

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
