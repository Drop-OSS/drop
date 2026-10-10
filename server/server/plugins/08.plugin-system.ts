import { initPlugins, pluginManager } from "../internal/plugins";
import metadataHandler from "../internal/metadata";
import {
  PluginMetadataProvider,
  metadataSourceForPluginId,
} from "../internal/metadata/plugin-provider";

export default defineNitroPlugin(async (nitro) => {
  await initPlugins();

  // Consume the external MetadataProvider SPI: register adapted plugin
  // providers so they participate in the admin search/import flow. Plugin ids
  // map onto the core MetadataSource enum; unmapped ids are skipped.
  for (const provider of pluginManager.getMetadataProviders()) {
    const source = metadataSourceForPluginId(provider.id);
    if (!source) continue;
    metadataHandler.addProvider(new PluginMetadataProvider(provider, source));
  }

  nitro.hooks.hookOnce("close", async () => {
    const plugins = pluginManager.listPlugins();
    for (const plugin of plugins) {
      await pluginManager.unregisterPlugin(plugin.id);
    }
  });
});
