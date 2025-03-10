import { Developer, MetadataSource, Publisher } from "@prisma/client";
import { MetadataProvider, MissingMetadataProviderApiKey } from ".";
import {
  GameMetadataSearchResult,
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchPublisherMetadataParams,
  PublisherMetadata,
  _FetchDeveloperMetadataParams,
  DeveloperMetadata,
} from "./types";
import axios, { AxiosRequestConfig } from "axios";
import moment from "moment";
import TurndownService from "turndown";

interface GiantBombResponseType<T> {
  error: "OK" | string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T;
  version: string;
}

interface GameSearchResult {
  guid: string;
  name: string;
  deck: string;
  original_release_date?: string;
  expected_release_year?: number;
  image?: {
    icon_url: string;
  };
}

interface GameResult {
  guid: string;
  name: string;
  deck: string;
  description?: string;

  developers?: Array<{ id: number; name: string }>;
  publishers?: Array<{ id: number; name: string }>;

  number_of_user_reviews: number; // Doesn't provide an actual rating, so kinda useless
  original_release_date?: string;

  expected_release_day?: number;
  expected_release_month?: number;
  expected_release_year?: number;

  image: {
    icon_url: string;
    screen_large_url: string;
  };
  images: Array<{
    tags: string; // If it's "All Images", art, otherwise screenshot
    original: string;
  }>;
}

interface CompanySearchResult {
  guid: string;
  deck: string | null;
  description: string | null;
  name: string;
  website: string | null;

  image: {
    icon_url: string;
    screen_large_url: string;
  };
}

// Api Docs: https://www.giantbomb.com/api/
export class GiantBombProvider implements MetadataProvider {
  private apikey: string;
  private turndown: TurndownService;

  constructor() {
    const apikey = process.env.GIANT_BOMB_API_KEY;
    if (!apikey) throw new MissingMetadataProviderApiKey(this.name());

    this.apikey = apikey;

    this.turndown = new TurndownService();
    this.turndown.addRule("remove-links", {
      filter: ["a"],
      replacement: function (content) {
        return content;
      },
    });
  }

  private async request<T>(
    resource: string,
    url: string,
    query: { [key: string]: string },
    options?: AxiosRequestConfig
  ) {
    const queryString = new URLSearchParams({
      ...query,
      api_key: this.apikey,
      format: "json",
    }).toString();

    const finalURL = `https://www.giantbomb.com/api/${resource}/${url}?${queryString}`;

    const overlay: AxiosRequestConfig = {
      url: finalURL,
      baseURL: "",
    };
    const response = await axios.request<GiantBombResponseType<T>>(
      Object.assign({}, options, overlay)
    );
    return response;
  }

  id() {
    return "giantbomb";
  }
  name() {
    return "GiantBomb";
  }
  source() {
    return MetadataSource.GiantBomb;
  }

  async search(query: string): Promise<GameMetadataSearchResult[]> {
    const results = await this.request<Array<GameSearchResult>>("search", "", {
      query: query,
      resources: ["game"].join(","),
    });
    const mapped = results.data.results.map((result) => {
      const date =
        (result.original_release_date
          ? moment(result.original_release_date).year()
          : result.expected_release_year) ?? 0;

      const metadata: GameMetadataSearchResult = {
        id: result.guid,
        name: result.name,
        icon: result.image?.icon_url ?? "",
        description: result.deck,
        year: date,
      };

      return metadata;
    });

    return mapped;
  }
  async fetchGame({
    id,
    publisher,
    developer,
    createObject,
  }: _FetchGameMetadataParams): Promise<GameMetadata> {
    const result = await this.request<GameResult>("game", id, {});
    const gameData = result.data.results;

    const longDescription = gameData.description
      ? this.turndown.turndown(gameData.description)
      : gameData.deck;

    const publishers: Publisher[] = [];
    if (gameData.publishers) {
      for (const pub of gameData.publishers) {
        publishers.push(await publisher(pub.name));
      }
    }

    const developers: Developer[] = [];
    if (gameData.developers) {
      for (const dev of gameData.developers) {
        developers.push(await developer(dev.name));
      }
    }

    const icon = createObject(gameData.image.icon_url);
    const banner = createObject(gameData.image.screen_large_url);

    const imageURLs: string[] = gameData.images.map((e) => e.original);

    const images = [banner, ...imageURLs.map(createObject)];

    const releaseDate = gameData.original_release_date
      ? moment(gameData.original_release_date).toDate()
      : moment(
          `${gameData.expected_release_day ?? 1}/${
            gameData.expected_release_month ?? 1
          }/${gameData.expected_release_year ?? new Date().getFullYear()}`
        ).toDate();

    const metadata: GameMetadata = {
      id: gameData.guid,
      name: gameData.name,
      shortDescription: gameData.deck,
      description: longDescription,
      released: releaseDate,

      reviewCount: 0,
      reviewRating: 0,

      publishers,
      developers,

      icon,
      bannerId: banner,
      coverId: images[1] ?? banner,
      images,
    };

    return metadata;
  }
  async fetchPublisher({
    query,
    createObject,
  }: _FetchPublisherMetadataParams): Promise<PublisherMetadata> {
    const results = await this.request<Array<CompanySearchResult>>(
      "search",
      "",
      { query, resources: "company" }
    );

    // Find the right entry
    const company =
      results.data.results.find((e) => e.name == query) ??
      results.data.results.at(0);
    if (!company) throw new Error(`No results for "${query}"`);

    const longDescription = company.description
      ? this.turndown.turndown(company.description)
      : company.deck;

    const metadata: PublisherMetadata = {
      id: company.guid,
      name: company.name,
      shortDescription: company.deck ?? "",
      description: longDescription ?? "",
      website: company.website ?? "",

      logo: createObject(company.image.icon_url),
      banner: createObject(company.image.screen_large_url),
    };

    return metadata;
  }
  async fetchDeveloper(
    params: _FetchDeveloperMetadataParams
  ): Promise<DeveloperMetadata> {
    return await this.fetchPublisher(params);
  }
}
