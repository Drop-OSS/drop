import { PLUGIN_API_VERSION } from "../types";
import type { PluginContext, PluginMetadata, ServerPlugin } from "../types";

/**
 * Minimal reference plugin. Its only purpose is to prove the platform is not
 * GSE-shaped: a new plugin needs only a manifest and a route.
 */
export class HelloWorldPlugin implements ServerPlugin {
  metadata: PluginMetadata = {
    id: "hello-world",
    name: "Hello World",
    version: "1.0.0",
    description: "Reference plugin that answers GET /ping",
    author: "Heretek Games",
    builtin: true,
    apiVersion: PLUGIN_API_VERSION,
    trust: "trusted",
    capabilities: ["routes"],
  };

  init(ctx: PluginContext): void {
    ctx.registerRoute("GET", "/ping", () => ({ pong: true }));
  }
}

export const helloWorldPlugin = new HelloWorldPlugin();
