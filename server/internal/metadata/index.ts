import { MetadataSource } from "~/prisma/client";
import prisma from "../db/database";
import type {
  _FetchGameMetadataParams,
  _FetchCompanyMetadataParams,
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
  abstract fetchCompany(
    params: _FetchCompanyMetadataParams,
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

    let metadata: GameMetadata | undefined = undefined;
    try {
      metadata = await provider.fetchGame({
        id: result.id,
        name: result.name,
        // wrap in anonymous functions to keep references to this
        publisher: (name: string) => this.fetchCompany(name),
        developer: (name: string) => this.fetchCompany(name),
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

        publishers: {
          connect: metadata.publishers,
        },
        developers: {
          connect: metadata.developers,
        },

        libraryBasePath,
      },
    });
    // relate companies to game

    await pullObjects();

    return game;
  }

  // Careful with this function, it has no typechecking
  // Type-checking this thing is impossible
  private async fetchCompany(query: string) {
    const existing = await prisma.company.findFirst({
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
        result = await provider.fetchCompany({ query, createObject });
        if (result === undefined) {
          throw new Error(
            `${provider.source()} failed to find a company for "${query}`,
          );
        }
      } catch (e) {
        console.warn(e);
        dumpObjects();
        continue;
      }

      const object = await prisma.company.upsert({
        where: {
          metadataKey: {
            metadataSource: provider.source(),
            metadataId: result.id,
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
        update: {},
      });

      if (object.mLogoObjectId == result.logo) {
        // We created, and didn't update
        // So pull objects
        await pullObjects();
      }

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
