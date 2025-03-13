import { applicationSettings } from "../internal/config/application-configuration";
import metadataHandler, { MetadataProvider } from "../internal/metadata";
import { GiantBombProvider } from "../internal/metadata/giantbomb";
import { IGDBProvider } from "../internal/metadata/igdb";
import { ManualMetadataProvider } from "../internal/metadata/manual";
import { PCGamingWikiProvider } from "../internal/metadata/pcgamingwiki";

export default defineNitroPlugin(async (nitro) => {
  const metadataProviders = [
    GiantBombProvider,
    PCGamingWikiProvider,
    IGDBProvider,
  ];

  const providers: { [key: string]: MetadataProvider } = {};

  for (const provider of metadataProviders) {
    try {
      const prov = new provider();
      const id = prov.id();
      providers[id] = prov;

      console.log(`enabled metadata provider: ${prov.name()}`);
    } catch (e) {
      console.warn(`skipping metadata provider setup: ${e}`);
    }
  }

  // Add providers based on their position in the application settings
  const configuredProviderList = applicationSettings.get("metadataProviders");
  const max = configuredProviderList.length;
  for (const [index, providerId] of configuredProviderList.entries()) {
    const priority = max * 2 - index; // Offset by the length --- (max - index) + max
    const provider = providers[providerId];
    if (!provider) {
      console.warn(`failed to add existing metadata provider: ${providerId}`);
      continue;
    }
    metadataHandler.addProvider(provider, priority);
    delete providers[providerId];
  }

  // Add the rest with no position
  for (const [providerId, provider] of Object.entries(providers)) {
    metadataHandler.addProvider(provider);
  }

  metadataHandler.addProvider(new ManualMetadataProvider(), -1000);

  // Update the applicatonConfig
  await applicationSettings.set(
    "metadataProviders",
    metadataHandler.fetchProviderIdsInOrder()
  );
});
