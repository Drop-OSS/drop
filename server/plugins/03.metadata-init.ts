import type { MetadataProvider } from "../internal/metadata/content";
import metadataHandler from "../internal/metadata/content";
import type { ImageProvider } from "../internal/metadata/image";
import imageHandler from "../internal/metadata/image";
import { GiantBombProvider } from "../internal/metadata/providers/giantbomb";
import { IGDBProvider } from "../internal/metadata/providers/igdb";
import { ManualMetadataProvider } from "../internal/metadata/providers/manual";
import { PCGamingWikiProvider } from "../internal/metadata/providers/pcgamingwiki";
import { logger } from "~/server/internal/logging";
import { SteamGridDB } from "../internal/metadata/providers/steamgriddb";

export default defineNitroPlugin(async (_nitro) => {
  const metadataProviders = [
    GiantBombProvider,
    PCGamingWikiProvider,
    IGDBProvider,
    SteamGridDB,
  ];

  const providers = new Map<string, MetadataProvider | ImageProvider>();

  for (const provider of metadataProviders) {
    try {
      const prov = new provider();
      const id = prov.source();
      providers.set(id, prov);

      logger.info(`created metadata/image provider: ${prov.name()}`);
    } catch (e) {
      logger.warn(`skipping metadata provider setup: ${e}`);
    }
  }

  const max = metadataProviders.length;
  for (const [index, provider] of providers.entries().map((e, i) => [i, e[1]] as const)) {
    const priority = max * 2 - index; // Offset by the length --- (max - index) + max

    if ((provider as MetadataProvider)["search"]) {
      logger.info(`added ${provider.name()} as metadata provider`);
      metadataHandler.addProvider(provider as MetadataProvider, priority);
    }
    if((provider as ImageProvider)["searchImages"]){
      logger.info(`added ${provider.name()} as image provider`);
      imageHandler.addProvider(provider as ImageProvider, priority);
    }
  }

  metadataHandler.addProvider(new ManualMetadataProvider(), -1000);
});
