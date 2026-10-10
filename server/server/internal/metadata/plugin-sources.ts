import { MetadataSource } from "~/prisma/client/enums";

/**
 * Plugin id (from the external `MetadataProvider` SPI) to core `MetadataSource`
 * enum. Plugins whose id is absent cannot be persisted against the strict core
 * enum, so the registrar skips them.
 */
export const PLUGIN_METADATA_SOURCES: Record<string, MetadataSource> = {
  pcgamingwiki: MetadataSource.PCGamingWiki,
  steamgriddb: MetadataSource.SteamGridDB,
  launchbox: MetadataSource.LaunchBox,
  screenscraper: MetadataSource.ScreenScraper,
  mobygames: MetadataSource.MobyGames,
};

export function metadataSourceForPluginId(
  pluginId: string,
): MetadataSource | undefined {
  return PLUGIN_METADATA_SOURCES[pluginId];
}
