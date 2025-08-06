import { MetadataSource } from "~/prisma/client/enums";
import type { TaskRunContext } from "../../tasks";
import type { ImageProvider } from "../image";
import { ImageSearchResultType, type ImageSearchResult } from "../image/types";
import { MissingMetadataProviderConfig } from "../content";
import type { NitroFetchOptions } from "nitropack";

interface SearchResult {
  id: string;
  name: string;
  release_date: number;
}

interface SteamGridResponse<T> {
  success: boolean;
  data: Array<T>;
}

interface Grid {
  id: number;
  nsfw: boolean;
  humor: boolean;
  url: string;
  thumb: string;
}

export class SteamGridDB implements ImageProvider {
  private apikey: string;

  constructor() {
    const apikey = process.env.STEAMGRID_API_KEY;
    if (!apikey)
      throw new MissingMetadataProviderConfig("STEAMGRID_API_KEY", this.name());

    this.apikey = apikey;
  }

  private async request<T>(
    path: string,
    opts?: NitroFetchOptions<
      string,
      | "get"
      | "head"
      | "patch"
      | "post"
      | "put"
      | "delete"
      | "connect"
      | "options"
      | "trace"
    >,
  ) {
    const fullPath = `https://www.steamgriddb.com/api/v2${path}`;

    const response = await $fetch<T>(fullPath, {
      ...opts,
      headers: { ...opts?.headers, Authorization: `Bearer ${this.apikey}` },
    });

    return response;
  }

  name(): string {
    return "SteamGridDB";
  }
  source(): MetadataSource {
    return MetadataSource.SteamGridDB;
  }
  async searchImages(query: string): Promise<ImageSearchResult[]> {
    const games = await this.request<SteamGridResponse<SearchResult>>(
      `/search/autocomplete/${encodeURIComponent(query)}`,
    );
    if (!games.success)
      throw createError({
        statusCode: 500,
        statusMessage: "[SteamGridDB] Search indicated failed response.",
      });

    const firstGame = games.data.at(0);
    if (!firstGame)
      throw createError({
        statusCode: 404,
        statusMessage: "No results found.",
      });

    const grids = await this.request<SteamGridResponse<Grid>>(
      `/grids/game/${firstGame.id}&nsfw=false&humor=false`,
    );
    if (!grids.success)
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to fetch grids for result.",
      });

    const results = grids.data.map(
      (e) =>
        ({
          id: e.id.toString(),
          url: e.thumb,
          type: "image",
        }) satisfies ImageSearchResult,
    );

    return results;
  }
  importImages(
    images: ImageSearchResult[],
    taskRunContext?: TaskRunContext,
  ): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
}
