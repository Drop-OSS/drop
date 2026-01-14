import { IconsLinuxLogo, IconsWindowsLogo, IconsMacLogo } from "#components";
import { Platform } from "~/prisma/client/enums";

export const PLATFORM_ICONS = {
  [Platform.Linux]: IconsLinuxLogo,
  [Platform.Windows]: IconsWindowsLogo,
  [Platform.macOS]: IconsMacLogo,
};
