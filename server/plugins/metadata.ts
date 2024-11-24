import { MetadataHandler, MetadataProvider } from "../internal/metadata";
import { GiantBombProvider } from "../internal/metadata/giantbomb";

export const metadataHandler = new MetadataHandler();

const providerCreators: Array<() => MetadataProvider> = [() => new GiantBombProvider()];

export default defineNitroPlugin(async (nitro) => {
    for (const creator of providerCreators) {
        try {
            const instance = creator();
            metadataHandler.addProvider(instance);
        }
        catch (e) {
            console.warn(e);
        }
    }

    nitro.hooks.hook('request', (h3) => {
        h3.context.metadataHandler = metadataHandler;
    })
});