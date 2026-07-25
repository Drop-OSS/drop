import type {
  ComponentCustomOptions as _ComponentCustomOptions,
  ComponentCustomProperties as _ComponentCustomProperties,
} from "vue";
import type { Platform } from "~/prisma/client/enums";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties extends _ComponentCustomProperties {
    $t: (key: string, ...args: unknown[]) => string;
  }
}

export interface EmulatorLaunchObject {
  launchId: string;
  gameName: string;
  gameIcon: string;
  versionName: string;
  launchName: string;
  platform: Platform;
}
