import { type Prisma, MetadataSource } from "~/prisma/client";
import prisma from "../db/database";
import type {
  _FetchGameMetadataParams,
  _FetchCompanyMetadataParams,
  GameMetadata,
  GameMetadataSearchResult,
  InternalGameMetadataResult,
  CompanyMetadata,
  GameMetadataRating,
} from "./types";
import { ObjectTransactionalHandler } from "../objects/transactional";
import { PriorityListIndexed } from "../utils/prioritylist";
import { systemConfig } from "../config/sys-conf";
import type { TaskRunContext } from "../tasks";
import taskHandler, { wrapTaskContext } from "../tasks";
import { randomUUID } from "crypto";
import { fuzzy } from "fast-fuzzy";

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
export const DropUserAgent = `Drop/${systemConfig.getDropVersion()}`;

export abstract class MetadataProvider {
  abstract name(): string;
  abstract source(): MetadataSource;

  abstract search(query: string): Promise<GameMetadataSearchResult[]>;
  abstract fetchGame(
    params: _FetchGameMetadataParams,
    taskRunContext?: TaskRunContext,
  ): Promise<GameMetadata>;
  abstract fetchCompany(
    params: _FetchCompanyMetadataParams,
    taskRunContext?: TaskRunContext,
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
      .flat()
      .map((result) => {
        const match = fuzzy(query, result.name);
        return { ...result, fuzzy: match };
      })
      .sort((a, b) => b.fuzzy - a.fuzzy);

    return successfulResults;
  }

  async createGameWithoutMetadata(libraryId: string, libraryPath: string) {
    return await this.createGame(
      {
        id: "",
        name: libraryPath,
        sourceId: MetadataSource.Manual,
      },
      libraryId,
      libraryPath,
    );
  }

  private parseTags(tags: string[]) {
    const results: Array<Prisma.TagCreateOrConnectWithoutGamesInput> = [];

    tags.forEach((t) =>
      results.push({
        where: {
          name: t,
        },
        create: {
          name: t,
        },
      }),
    );

    return results;
  }

  private parseRatings(ratings: GameMetadataRating[]) {
    const results: Array<Prisma.GameRatingCreateOrConnectWithoutGameInput> = [];

    ratings.forEach((r) => {
      results.push({
        where: {
          metadataKey: {
            metadataId: r.metadataId,
            metadataSource: r.metadataSource,
          },
        },
        create: {
          ...r,
        },
      });
    });

    return results;
  }

  async createGame(
    result: { sourceId: string; id: string; name: string },
    libraryId: string,
    libraryPath: string,
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
    if (existing) return undefined;

    const gameId = randomUUID();

    const taskId = `import:${gameId}`;
    await taskHandler.create({
      name: `Import game "${result.name}" (${libraryPath})`,
      id: taskId,
      taskGroup: "import:game",
      acls: ["system:import:game:read"],
      async run(context) {
        const { progress, log } = context;

        progress(0);

        const [createObject, pullObjects, dumpObjects] =
          metadataHandler.objectHandler.new(
            {},
            ["internal:read"],
            wrapTaskContext(context, {
              min: 63,
              max: 100,
              prefix: "[object import] ",
            }),
          );

        let metadata: GameMetadata | undefined = undefined;
        try {
          metadata = await provider.fetchGame(
            {
              id: result.id,
              name: result.name,
              // wrap in anonymous functions to keep references to this
              publisher: (name: string) => metadataHandler.fetchCompany(name),
              developer: (name: string) => metadataHandler.fetchCompany(name),
              createObject,
            },
            wrapTaskContext(context, {
              min: 0,
              max: 60,
              prefix: "[metadata import] ",
            }),
          );
        } catch (e) {
          dumpObjects();
          throw e;
        }

        context?.progress(60);

        await prisma.game.create({
          data: {
            id: gameId,
            metadataSource: provider.source(),
            metadataId: metadata.id,

            mName: metadata.name,
            mShortDescription: metadata.shortDescription,
            mDescription: metadata.description,
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

            ratings: {
              connectOrCreate: metadataHandler.parseRatings(metadata.reviews),
            },
            tags: {
              connectOrCreate: metadataHandler.parseTags(metadata.tags),
            },

            libraryId,
            libraryPath,
          },
        });

        progress(63);
        log(`Successfully fetched all metadata.`);
        log(`Importing objects...`);

        await pullObjects();

        log(`Finished game import.`);
      },
    });

    return taskId;
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
          mCoverObjectId: result.cover,
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
