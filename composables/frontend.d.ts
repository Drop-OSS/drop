import type {
  ComponentCustomOptions as _ComponentCustomOptions,
  ComponentCustomProperties as _ComponentCustomProperties,
} from "vue";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties extends _ComponentCustomProperties {
    $t: (key: string, ...args: any[]) => string;
  }
  interface ComponentCustomOptions extends _ComponentCustomOptions {}
}

export interface ExecutorLaunchObject {
  launchId: string;
  gameName: string;
  gameIcon: string;
  versionName: string;
  launchName: string;
}
