import { Platform } from "@prisma/client";

export function parsePlatform(platform: string) {
  switch (platform) {
    case "linux":
    case "Linux":
      return Platform.Linux;
    case "windows":
    case "Windows":
      return Platform.Windows;
    case "macOS":
    case "MacOS":
    case "mac":
      return Platform.macOS;
  }

  return undefined;
}
