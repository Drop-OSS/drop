import { applicationSettings } from "../internal/config/application-configuration";
import type { MetadataProvider } from "../internal/metadata";
import metadataHandler from "../internal/metadata";
import { GiantBombProvider } from "../internal/metadata/giantbomb";
import { IGDBProvider } from "../internal/metadata/igdb";
import { ManualMetadataProvider } from "../internal/metadata/manual";
import { PCGamingWikiProvider } from "../internal/metadata/pcgamingwiki";

export default defineNitroPlugin(async (_nitro) => {
  const metadataProviders = [
    GiantBombProvider,
    PCGamingWikiProvider,
    IGDBProvider,
  ];

  const providers = new Map<string, MetadataProvider>();

  for (const provider of metadataProviders) {
    try {
      const prov = new provider();
      const id = prov.source();
      providers.set(id, prov);

      console.log(`enabled metadata provider: ${prov.name()}`);
    } catch (e) {
      console.warn(`skipping metadata provider setup: ${e}`);
    }
  }

  // Add providers based on their position in the application settings
  const configuredProviderList =
    await applicationSettings.get("metadataProviders");
  const max = configuredProviderList.length;
  for (const [index, providerId] of configuredProviderList.entries()) {
    const priority = max * 2 - index; // Offset by the length --- (max - index) + max
    const provider = providers.get(providerId);
    if (!provider) {
      console.warn(`failed to add existing metadata provider: ${providerId}`);
      continue;
    }
    metadataHandler.addProvider(provider, priority);
    providers.delete(providerId);
  }

  // Add the rest with no position
  for (const [, provider] of providers.entries()) {
    metadataHandler.addProvider(provider);
  }

  metadataHandler.addProvider(new ManualMetadataProvider(), -1000);

  // Update the applicatonConfig
  await applicationSettings.set(
    "metadataProviders",
    metadataHandler.fetchProviderIdsInOrder(),
  );
});
