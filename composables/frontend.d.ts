import type {
  ComponentCustomOptions as _ComponentCustomOptions,
  ComponentCustomProperties as _ComponentCustomProperties,
} from "vue";
import type { Platform } from "~/prisma/client/enums";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties extends _ComponentCustomProperties {
    $t: (key: string, ...args: unknown[]) => string;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ComponentCustomOptions extends _ComponentCustomOptions {}
}

export interface ExecutorLaunchObject {
  launchId: string;
  gameName: string;
  gameIcon: string;
  versionName: string;
  launchName: string;
  platform: Platform;
}
