import {
  Developer,
  MetadataSource,
  PrismaClient,
  Publisher,
} from "@prisma/client";
import prisma from "../db/database";
import {
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
import { PriorityList, PriorityListIndexed } from "../utils/prioritylist";

export abstract class MetadataProvider {
  abstract id(): string;
  abstract name(): string;
  abstract source(): MetadataSource;

  abstract search(query: string): Promise<GameMetadataSearchResult[]>;
  abstract fetchGame(params: _FetchGameMetadataParams): Promise<GameMetadata>;
  abstract fetchPublisher(
    params: _FetchPublisherMetadataParams
  ): Promise<PublisherMetadata>;
  abstract fetchDeveloper(
    params: _FetchDeveloperMetadataParams
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

  async search(query: string) {
    const promises: Promise<InternalGameMetadataResult[]>[] = [];
    for (const provider of this.providers.values()) {
      const queryTransformationPromise = new Promise<
        InternalGameMetadataResult[]
      >(async (resolve, reject) => {
        try {
          const results = await provider.search(query);
          const mappedResults: InternalGameMetadataResult[] = results.map(
            (result) =>
              Object.assign({}, result, {
                sourceId: provider.id(),
                sourceName: provider.name(),
              })
          );
          resolve(mappedResults);
        } catch (e) {
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
      libraryBasePath
    );
  }

  async createGame(
    result: InternalGameMetadataResult,
    libraryBasePath: string
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
      ["internal:read"]
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

    await pullObjects();
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

    return game;
  }

  async fetchDeveloper(query: string) {
    return (await this.fetchDeveloperPublisher(
      query,
      "fetchDeveloper",
      "developer"
    )) as Developer;
  }

  async fetchPublisher(query: string) {
    return (await this.fetchDeveloperPublisher(
      query,
      "fetchPublisher",
      "publisher"
    )) as Publisher;
  }

  // Careful with this function, it has no typechecking
  // Type-checking this thing is impossible
  private async fetchDeveloperPublisher(
    query: string,
    functionName: any,
    databaseName: any
  ) {
    const existing = await (prisma as any)[databaseName].findFirst({
      where: {
        metadataOriginalQuery: query,
      },
    });
    if (existing) return existing;

    for (const provider of this.providers.values() as any) {
      const [createObject, pullObjects, dumpObjects] = this.objectHandler.new(
        {},
        ["internal:read"]
      );
      let result;
      try {
        result = await provider[functionName]({ query, createObject });
      } catch (e) {
        console.warn(e);
        dumpObjects();
        continue;
      }

      // If we're successful
      await pullObjects();

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
      `No metadata provider found a ${databaseName} for "${query}"`
    );
  }
}

export default new MetadataHandler();
