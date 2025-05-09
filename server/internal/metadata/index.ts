import type { Developer, Publisher } from "~/prisma/client";
import { MetadataSource } from "~/prisma/client";
import prisma from "../db/database";
import type {
  _FetchDeveloperMetadataParams,
  _FetchGameMetadataParams,
  _FetchPublisherMetadataParams,
  GameMetadata,
  GameMetadataSearchResult,
  InternalGameMetadataResult,
  CompanyMetadata,
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
  abstract name(): string;
  abstract source(): MetadataSource;

  abstract search(query: string): Promise<GameMetadataSearchResult[]>;
  abstract fetchGame(params: _FetchGameMetadataParams): Promise<GameMetadata>;
  abstract fetchPublisher(
    params: _FetchPublisherMetadataParams,
  ): Promise<CompanyMetadata | undefined>;
  abstract fetchDeveloper(
    params: _FetchDeveloperMetadataParams,
  ): Promise<CompanyMetadata | undefined>;
}

export class MetadataHandler {
  // Ordered by priority
  private providers: PriorityListIndexed<MetadataProvider> =
    new PriorityListIndexed("source");
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
      .map((e) => e.source())
      .filter((e) => e !== "Manual");
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
                sourceId: provider.source(),
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
          metadataId: result.id,
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

        mReviewCount: metadata.reviewCount,
        mReviewRating: metadata.reviewRating,
        mReleased: metadata.released,

        mIconObjectId: metadata.icon,
        mBannerObjectId: metadata.bannerId,
        mCoverObjectId: metadata.coverId,
        mImageLibraryObjectIds: metadata.images,

        libraryBasePath,
      },
    });
    // relate companies to game
    for (const pub of metadata.publishers) {
      await prisma.companyGameRelation.upsert({
        where: {
          companyGame: {
            gameId: game.id,
            companyId: pub.id,
          },
        },
        create: {
          gameId: game.id,
          companyId: pub.id,
          publisher: true,
        },
        update: {
          publisher: true,
        },
      });
    }
    for (const dev of metadata.developers) {
      await prisma.companyGameRelation.upsert({
        where: {
          companyGame: {
            gameId: game.id,
            companyId: dev.id,
          },
        },
        create: {
          gameId: game.id,
          companyId: dev.id,
          developer: true,
        },
        update: {
          developer: true,
        },
      });
    }

    await pullObjects();

    return game;
  }

  async fetchDeveloper(query: string) {
    return (await this.fetchDeveloperPublisher(
      query,
      "fetchDeveloper",
      "developer",
    )) as Developer | undefined;
  }

  async fetchPublisher(query: string) {
    return (await this.fetchDeveloperPublisher(
      query,
      "fetchPublisher",
      "publisher",
    )) as Publisher | undefined;
  }

  // Careful with this function, it has no typechecking
  // Type-checking this thing is impossible
  private async fetchDeveloperPublisher(
    query: string,
    functionName: "fetchDeveloper" | "fetchPublisher",
    type: "developer" | "publisher",
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any)[type].findFirst({
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
      let result: CompanyMetadata | undefined;
      try {
        result = await provider[functionName]({ query, createObject });
        if (result === undefined) {
          throw new Error(
            `${provider.source()} failed to find a ${type} for "${query}`,
          );
        }
      } catch (e) {
        console.warn(e);
        dumpObjects();
        continue;
      }

      // If we're successful
      await pullObjects();

      // TODO: dedupe metadata in event that a company with same source and id appears
      const object = await prisma.company.upsert({
        where: {
          metadataKey: {
            metadataId: result.id,
            metadataSource: provider.source(),
          },
        },
        create: {
          metadataSource: provider.source(),
          metadataId: result.id,
          metadataOriginalQuery: query,

          mName: result.name,
          mShortDescription: result.shortDescription,
          mDescription: result.description,
          mLogoObjectId: result.logo,
          mBannerObjectId: result.banner,
          mWebsite: result.website,
        },
        update: {
          mName: result.name,
          mShortDescription: result.shortDescription,
          mDescription: result.description,
          mLogoObjectId: result.logo,
          mBannerObjectId: result.banner,
          mWebsite: result.website,
        },
      });

      return object;
    }

    // throw new Error(
    //   `No metadata provider found a ${databaseName} for "${query}"`,
    // );
    return undefined;
  }
}

export const metadataHandler = new MetadataHandler();
export default metadataHandler;
