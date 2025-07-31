import { IconsLinuxLogo, IconsWindowsLogo, IconsMacLogo } from "#components";
import { PlatformClient } from "./types";

export const PLATFORM_ICONS = {
  [PlatformClient.Linux]: IconsLinuxLogo,
  [PlatformClient.Windows]: IconsWindowsLogo,
  [PlatformClient.macOS]: IconsMacLogo,
};
