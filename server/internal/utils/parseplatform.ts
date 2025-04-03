import { Platform } from "@prisma/client";

export function parsePlatform(platform: string) {
  switch (platform.toLowerCase()) {
    case "linux":
      return Platform.Linux;
    case "windows":
      return Platform.Windows;
    case "mac":
    case "macos":
      return Platform.macOS;
  }

  return undefined;
}
