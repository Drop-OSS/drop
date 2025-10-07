import fs from "fs";

export function fsStats(folder: string) {
  const stats = fs.statfsSync(folder);
  const freeSpace = stats.bavail * stats.bsize;
  const totalSpace = stats.blocks * stats.bsize;
  return { freeSpace, totalSpace };
}
