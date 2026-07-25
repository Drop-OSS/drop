import type { CompanyModel } from "~/prisma/client/models";
import { MetadataSource } from "~/prisma/client/enums";
import type { MetadataProvider } from ".";
import { MissingMetadataProviderConfig } from ".";
import type {
  GameMetadataSearchResult,
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchCompanyMetadataParams,
  CompanyMetadata,
  GameMetadataRating,
} from "./types";
import TurndownService from "turndown";
import { DateTime } from "luxon";
import type { TaskRunContext } from "../tasks";
import type { NitroFetchOptions, NitroFetchRequest } from "nitropack";

interface GiantBombResponseType<T> {
  error: string;
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

  reviews?: Array<{
    api_detail_url: string;
  }>;

  genres?: Array<{
    name: string;
    id: number;
  }>;
}

interface ReviewResult {
  deck: string;
  score: number; // Out of 5
  reviewer: string;
  site_detail_url: string;
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
  private readonly apikey: string;
  private readonly turndown: TurndownService;

  constructor() {
    const apikey = process.env.GIANT_BOMB_API_KEY;
    if (!apikey)
      throw new MissingMetadataProviderConfig(
        "GIANT_BOMB_API_KEY",
        this.name(),
      );

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
    options?: NitroFetchOptions<NitroFetchRequest, "post">,
  ) {
    const queryString = new URLSearchParams({
      ...query,
      api_key: this.apikey,
      format: "json",
    }).toString();

    const finalURL = `https://www.giantbomb.com/api/${resource}/${url}?${queryString}`;

    const response = await $fetch<GiantBombResponseType<T>>(finalURL, options);
    return response;
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
    const mapped = results.results.map((result) => {
      const date =
        (result.original_release_date
          ? DateTime.fromISO(result.original_release_date).year
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
  private async importCompanies(
    items: Array<{ name: string }> | undefined,
    label: string,
    company: (name: string) => Promise<CompanyModel | undefined>,
    context?: TaskRunContext,
  ): Promise<CompanyModel[]> {
    const results: CompanyModel[] = [];
    if (!items) return results;

    for (const item of items) {
      context?.logger.info(`Importing ${label} "${item.name}"`);
      const res = await company(item.name);
      if (res === undefined) {
        context?.logger.warn(`Failed to import ${label} "${item.name}"`);
        continue;
      }
      context?.logger.info(`Imported ${label} "${item.name}"`);
      results.push(res);
    }
    return results;
  }

  private async importReviews(
    reviews: Array<{ api_detail_url: string }> | undefined,
    context?: TaskRunContext,
  ): Promise<GameMetadataRating[]> {
    const results: GameMetadataRating[] = [];
    if (!reviews) return results;

    context?.logger.info("Found reviews, importing...");
    for (const { api_detail_url } of reviews) {
      const reviewId = api_detail_url.split("/").at(-2);
      if (!reviewId) continue;
      const review = await this.request<ReviewResult>("review", reviewId, {});
      results.push({
        metadataSource: MetadataSource.GiantBomb,
        metadataId: reviewId,
        mReviewCount: 1,
        mReviewRating: review.results.score / 5,
        mReviewHref: review.results.site_detail_url,
      });
    }
    return results;
  }

  async fetchGame(
    { id, company, createObject }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    context?.logger.info("Using GiantBomb provider");

    const result = await this.request<GameResult>("game", id, {});
    const gameData = result.results;

    const longDescription = gameData.description
      ? this.turndown.turndown(gameData.description)
      : gameData.deck;

    const publishers = await this.importCompanies(
      gameData.publishers,
      "publisher",
      company,
      context,
    );
    context?.progress(35);

    const developers = await this.importCompanies(
      gameData.developers,
      "developer",
      company,
      context,
    );
    context?.progress(70);

    const icon = createObject(gameData.image.icon_url);
    const banner = createObject(gameData.image.screen_large_url);

    const imageURLs: string[] = gameData.images.map((e) => e.original);

    const images = [banner, ...imageURLs.map(createObject)];

    context?.logger.info(`Found all images. Total of ${images.length + 1}.`);

    const releaseDate = gameData.original_release_date
      ? DateTime.fromISO(gameData.original_release_date).toJSDate()
      : new Date();

    context?.progress(85);

    const reviews = await this.importReviews(gameData.reviews, context);

    const tags = (gameData.genres ?? []).map((e) => e.name);

    const metadata: GameMetadata = {
      id: gameData.guid,
      name: gameData.name,
      shortDescription: gameData.deck,
      description: longDescription,
      released: releaseDate,

      tags,

      reviews,

      publishers,
      developers,

      icon,
      bannerId: banner,
      coverId: images[1] ?? banner,
      images,
    };

    context?.logger.info("GiantBomb provider finished.");
    context?.progress(100);

    return metadata;
  }
  async fetchCompany({
    query,
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata | undefined> {
    const results = await this.request<Array<CompanySearchResult>>(
      "search",
      "",
      { query, resources: "company" },
    );

    // Find the right entry
    const company =
      results.results.find((e) => e.name == query) ?? results.results.at(0);
    if (!company) return undefined;

    const longDescription = company.description
      ? this.turndown.turndown(company.description)
      : company.deck;

    const metadata: CompanyMetadata = {
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
}
