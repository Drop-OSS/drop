import { pluginManager } from "./manager";
import { helloWorldPlugin } from "./builtin/hello-world";

export * from "./types";
export * from "./errors";
export * from "./storage";
export * from "./settings";
export * from "./manager";
export { helloWorldPlugin } from "./builtin/hello-world";

export async function initPlugins(): Promise<void> {
  // Register default built-in plugins
  await pluginManager.registerPlugin(helloWorldPlugin);
  // Discover and load external plugins from data directory
  await pluginManager.discoverAndLoadExternalPlugins();
}

export default pluginManager;
