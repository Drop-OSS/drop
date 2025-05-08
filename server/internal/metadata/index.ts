import type { Developer, Publisher } from "~/prisma/client";
import { MetadataSource } from "~/prisma/client";
import prisma from "../db/database";
import type {
  _FetchDeveloperMetadataParams,
  _FetchGameMetadataParams,
  _FetchPublisherMetadataParams,
  DeveloperMetadata,
  GameMetadata,
  GameMetadataSearchResult,
  InternalGameMetadataResult,
  PublisherMetadata,
} from "./types";
import { ObjectTransactionalHandler } from "../objects/transactional";
import { PriorityListIndexed } from "../utils/prioritylist";

export class MissingMetadataProviderConfig extends Error {
  private providerName: string;

  constructor(configKey: string, providerName: string) {
    super(`Missing config item ${configKey} for ${providerName}`);
    this.providerName = providerName;
  }

  getProviderName() {
    return this.providerName;
  }
}

// TODO: add useragent to all outbound api calls (best practice)
export const DropUserAgent = "Drop/0.2";

export abstract class MetadataProvider {
  abstract id(): string;
  abstract name(): string;
  abstract source(): MetadataSource;

  abstract search(query: string): Promise<GameMetadataSearchResult[]>;
  abstract fetchGame(params: _FetchGameMetadataParams): Promise<GameMetadata>;
  abstract fetchPublisher(
    params: _FetchPublisherMetadataParams,
  ): Promise<PublisherMetadata>;
  abstract fetchDeveloper(
    params: _FetchDeveloperMetadataParams,
  ): Promise<DeveloperMetadata>;
}

export class MetadataHandler {
  // Ordered by priority
  private providers: PriorityListIndexed<MetadataProvider> =
    new PriorityListIndexed("id");
  private objectHandler: ObjectTransactionalHandler =
    new ObjectTransactionalHandler();

  addProvider(provider: MetadataProvider, priority: number = 0) {
    this.providers.push(provider, priority);
  }

  /**
   * Returns provider IDs, used to save to applicationConfig
   * @returns The provider IDs in order, missing manual
   */
  fetchProviderIdsInOrder() {
    return this.providers
      .values()
      .map((e) => e.id())
      .filter((e) => e !== "manual");
  }

  async search(query: string) {
    const promises: Promise<InternalGameMetadataResult[]>[] = [];
    for (const provider of this.providers.values()) {
      const queryTransformationPromise = new Promise<
        InternalGameMetadataResult[]
        // TODO: fix eslint error
        // eslint-disable-next-line no-async-promise-executor
      >(async (resolve, reject) => {
        try {
          const results = await provider.search(query);
          const mappedResults: InternalGameMetadataResult[] = results.map(
            (result) =>
              Object.assign({}, result, {
                sourceId: provider.id(),
                sourceName: provider.name(),
              }),
          );
          resolve(mappedResults);
        } catch (e) {
          console.warn(e);
          reject(e);
        }
      });
      promises.push(queryTransformationPromise);
    }

    const results = await Promise.allSettled(promises);
    const successfulResults = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .flat();

    return successfulResults;
  }

  async createGameWithoutMetadata(libraryBasePath: string) {
    return await this.createGame(
      {
        id: "",
        name: libraryBasePath,
        icon: "",
        description: "",
        year: 0,
        sourceId: "manual",
        sourceName: "Manual",
      },
      libraryBasePath,
    );
  }

  async createGame(
    result: InternalGameMetadataResult,
    libraryBasePath: string,
  ) {
    const provider = this.providers.get(result.sourceId);
    if (!provider)
      throw new Error(`Invalid metadata provider for ID "${result.sourceId}"`);

    const existing = await prisma.game.findUnique({
      where: {
        metadataKey: {
          metadataSource: provider.source(),
          metadataId: provider.id(),
        },
      },
    });
    if (existing) return existing;

    const [createObject, pullObjects, dumpObjects] = this.objectHandler.new(
      {},
      ["internal:read"],
    );

    let metadata;
    try {
      metadata = await provider.fetchGame({
        id: result.id,
        name: result.name,
        // wrap in anonymous functions to keep references to this
        publisher: (name: string) => this.fetchPublisher(name),
        developer: (name: string) => this.fetchDeveloper(name),
        createObject,
      });
    } catch (e) {
      dumpObjects();
      throw e;
    }

    const game = await prisma.game.create({
      data: {
        metadataSource: provider.source(),
        metadataId: metadata.id,

        mName: metadata.name,
        mShortDescription: metadata.shortDescription,
        mDescription: metadata.description,
        mDevelopers: {
          connect: metadata.developers,
        },
        mPublishers: {
          connect: metadata.publishers,
        },

        mReviewCount: metadata.reviewCount,
        mReviewRating: metadata.reviewRating,
        mReleased: metadata.released,

        mIconId: metadata.icon,
        mBannerId: metadata.bannerId,
        mCoverId: metadata.coverId,
        mImageLibrary: metadata.images,

        libraryBasePath,
      },
    });
    await pullObjects();

    return game;
  }

  async fetchDeveloper(query: string) {
    return (await this.fetchDeveloperPublisher(
      query,
      "fetchDeveloper",
      "developer",
    )) as Developer;
  }

  async fetchPublisher(query: string) {
    return (await this.fetchDeveloperPublisher(
      query,
      "fetchPublisher",
      "publisher",
    )) as Publisher;
  }

  // Careful with this function, it has no typechecking
  // Type-checking this thing is impossible
  private async fetchDeveloperPublisher(
    query: string,
    functionName: "fetchDeveloper" | "fetchPublisher",
    databaseName: "developer" | "publisher",
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any)[databaseName].findFirst({
      where: {
        metadataOriginalQuery: query,
      },
    });
    if (existing) return existing;

    for (const provider of this.providers.values()) {
      // don't allow manual provider to "fetch" metadata
      if (provider.source() === MetadataSource.Manual) continue;

      const [createObject, pullObjects, dumpObjects] = this.objectHandler.new(
        {},
        ["internal:read"],
      );
      let result: PublisherMetadata;
      try {
        result = await provider[functionName]({ query, createObject });
      } catch (e) {
        console.warn(e);
        dumpObjects();
        continue;
      }

      // If we're successful
      await pullObjects();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const object = await (prisma as any)[databaseName].create({
        data: {
          metadataSource: provider.source(),
          metadataId: provider.id(),
          metadataOriginalQuery: query,

          mName: result.name,
          mShortDescription: result.shortDescription,
          mDescription: result.description,
          mLogo: result.logo,
          mBanner: result.banner,
          mWebsite: result.website,
        },
      });

      return object;
    }

    throw new Error(
      `No metadata provider found a ${databaseName} for "${query}"`,
    );
  }
}

export const metadataHandler = new MetadataHandler();
export default metadataHandler;
