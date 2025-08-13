import type { MetadataSource } from "~/prisma/client/enums";
import type { ImageSearchResult } from "./types";
import type { TaskRunContext } from "../../tasks";
import { ObjectTransactionalHandler } from "../../objects/transactional";
import { PriorityListIndexed } from "../../utils/prioritylist";
import { logger } from "../../logging";

export abstract class ImageProvider {
  abstract name(): string;
  abstract source(): MetadataSource;

  abstract searchImages(query: string): Promise<ImageSearchResult[]>;
  abstract importImages(
    images: ImageSearchResult[],
    taskRunContext?: TaskRunContext,
  ): Promise<string[]>; // List of object IDs
}

/**
 * Confusingly, does videos too.
 */
export class ImageHandler {
  private providers: PriorityListIndexed<ImageProvider> =
    new PriorityListIndexed("source");
  private objectHandler: ObjectTransactionalHandler =
    new ObjectTransactionalHandler();

  addProvider(provider: ImageProvider, priority: number = 0) {
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

  async searchImages(query: string) {
    const providers = this.providers.values();
    const promises = [];
    for (const provider of providers) {
      const localFetch = async () => {
        try {
          const providerResults = await provider.searchImages(query);
          return providerResults.map((result) => ({ ...result, provider: provider.source() }));
        } catch (e) {
          throw `${provider.name()}: ${e}`;
        }
      };
      promises.push(localFetch());
    }

    const result = await Promise.allSettled(promises);

    const fails = result.filter((e) => e.status === "rejected");
    if (fails.length > 0) {
      const failText = fails
        .map((e) => e.reason)
        .map((e) => "" + e)
        .join("\n");

      logger.warn(
        `Failed to fetch some images from providers. Errors:\n${failText}`,
      );
    }

    const successes = result
      .filter((e) => e.status === "fulfilled")
      .map((e) => e.value)
      .flat();
    return successes;
  }
}

export const imageHandler = new ImageHandler();
export default imageHandler;
