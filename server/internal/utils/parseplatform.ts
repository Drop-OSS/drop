import { HardwarePlatform } from "~/prisma/client/enums";

export function parsePlatform(platform: string) {
  switch (platform.toLowerCase()) {
    case "linux":
      return HardwarePlatform.Linux;
    case "windows":
      return HardwarePlatform.Windows;
    case "mac":
    case "macos":
      return HardwarePlatform.macOS;
  }

  return undefined;
}
