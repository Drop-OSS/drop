import * as jdenticon from "jdenticon";
import type { MetadataSource } from "~/prisma/client/enums";
import { MetadataProvider } from ".";
import type {
  CompanyMetadata,
  GameMetadata,
  GameMetadataSearchResult,
  _FetchCompanyMetadataParams,
  _FetchGameMetadataParams,
} from "./types";
import type { MetadataProvider as ExternalMetadataProvider } from "../plugins/types";

export { metadataSourceForPluginId } from "./plugin-sources";

/**
 * Adapts an external `MetadataProvider` SPI implementation to the core
 * `MetadataProvider` contract so plugin-provided sources participate in the
 * admin search/import flow. Companies are not resolved (the SPI does not expose
 * company entities); developers/publishers come back as tags instead.
 */
export class PluginMetadataProvider extends MetadataProvider {
  constructor(
    private readonly plugin: ExternalMetadataProvider,
    private readonly mappedSource: MetadataSource,
  ) {
    super();
  }

  name(): string {
    return this.plugin.name;
  }

  source(): MetadataSource {
    return this.mappedSource;
  }

  async search(query: string): Promise<GameMetadataSearchResult[]> {
    const results = await this.plugin.search(query);
    return results.map((result) => ({
      id: result.id,
      name: result.title,
      icon: result.coverUrl ?? result.iconUrl ?? "",
      description: result.description ?? "",
      year: result.releaseYear ?? 0,
    }));
  }

  async fetchGame({
    id,
    name,
    createObject,
  }: _FetchGameMetadataParams): Promise<GameMetadata> {
    const details = await this.plugin.getDetails(id);
    if (!details) {
      throw new Error(
        `Plugin metadata provider '${this.plugin.id}' has no entry for '${id}'`,
      );
    }

    const icon = createObject(
      details.coverUrl ?? details.iconUrl ?? jdenticon.toPng(name, 512),
    );

    const tags = new Set<string>([
      ...(details.genres ?? []),
      ...(details.developers ?? []),
      ...(details.publishers ?? []),
    ]);

    return {
      id: details.id,
      name: details.title,
      shortDescription: details.description ?? "",
      description: details.description ?? "",
      released: details.releaseYear
        ? new Date(details.releaseYear, 0, 1)
        : new Date(),

      tags: [...tags],

      reviews: [],
      ageRatings: [],

      publishers: [],
      developers: [],

      icon,
      bannerId: icon,
      coverId: icon,
      images: details.screenshots?.length ? details.screenshots : [icon],
    };
  }

  async fetchCompany(
    _params: _FetchCompanyMetadataParams,
  ): Promise<CompanyMetadata | undefined> {
    return undefined;
  }
}
