import { Platform } from "@prisma/client";

export function parsePlatform(platform: string) {
  switch (platform) {
    case "linux":
    case "Linux":
      return Platform.Linux;
    case "windows":
    case "Windows":
      return Platform.Windows;
  }

  return undefined;
}
