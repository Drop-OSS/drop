import { _FetchDeveloperMetadataParams, _FetchGameMetadataParams, _FetchPublisherMetadataParams, DeveloperMetadata, GameMetadata, GameMetadataSearchResult, InternalGameMetadataResult, PublisherMetadata } from "./types";


export abstract class MetadataProvider {
    abstract id(): string;
    abstract name(): string;

    abstract search(query: string): Promise<GameMetadataSearchResult[]>;
    abstract fetchGame(params: _FetchGameMetadataParams): Promise<GameMetadata>;
    abstract fetchPublisher(params: _FetchPublisherMetadataParams): Promise<PublisherMetadata>;
    abstract fetchDeveloper(params: _FetchDeveloperMetadataParams): Promise<DeveloperMetadata>;
}

class MetadataHandler {
    // Ordered by priority
    private providers: Map<string, MetadataProvider> = new Map();
    private createObject: (url: string) => Promise<string>;

    constructor() {
        this.createObject = async () => "";
    }

    async search(query: string) {
        const promises: Promise<InternalGameMetadataResult[]>[] = [];
        for (const provider of this.providers.values()) {
            const queryTransformationPromise = new Promise<InternalGameMetadataResult[]>(async (resolve, reject) => {
                const results = await provider.search(query);
                const mappedResults: InternalGameMetadataResult[] = results.map((result) => Object.assign(
                    {},
                    result,
                    {
                        sourceId: provider.id(),
                        sourceName: provider.name()
                    }
                ));
                resolve(mappedResults);
            });
            promises.push(queryTransformationPromise);
        }

        const results = await Promise.allSettled(promises);
        const successfulResults = results.filter((result) => result.status === 'fulfilled').map((result) => result.value).flat();

        return successfulResults;
    }

    async fetchGame(game: InternalGameMetadataResult) {

    }

    async fetchDeveloper(query: string) {
        
    }
}

export default new MetadataHandler();