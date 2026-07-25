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
} from "./types";
import { DateTime } from "luxon";
import * as jdenticon from "jdenticon";
import type { TaskRunContext } from "../tasks";
import { logger } from "~/server/internal/logging";
import type { NitroFetchOptions, NitroFetchRequest } from "nitropack";

interface TwitchAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string; // likely 'bearer'
}

interface IGDBErrorResponse {
  title: string;
  status: number;
  cause: string;
}

interface IGDBItem {
  id: number;
}

interface IGDBGenre extends IGDBItem {
  name: string;
  slug: string;
  url: string;
}

// denotes role a company had in a game
interface IGDBInvolvedCompany extends IGDBItem {
  company: number;
  game: number;

  developer: boolean;
  porting: boolean;
  publisher: boolean;
  supporting: boolean;

  created_at: number;
  updated_at: number;
}

interface IGDBCompany extends IGDBItem {
  name: string;
  country: number; // ISO 3166-1 country code
  description: string;
  logo: number;
  parent: number;
  slug: string;
  start_date: number;
  status: number;
  websites: number[];
}

interface IGDBCompanyWebsite extends IGDBItem {
  trusted: boolean;
  url: string;
}

interface IGDBCover extends IGDBItem {
  image_id: string;
}

interface IGDBSearchStub extends IGDBItem {
  name: string;
  cover?: number;
  first_release_date?: number; // unix timestamp
  summary: string;
}

// https://api-docs.igdb.com/?shell#game
interface IGDBGameFull extends IGDBSearchStub {
  age_ratings?: number[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  alternative_names?: number[];
  artworks?: number[];
  bundles?: number[];
  checksum?: string;
  collections?: number[];
  created_at: number; // unix timestamp
  dlcs?: number[];
  expanded_games?: number[];
  expansions?: number[];
  external_games?: number[];
  forks?: number[];
  franchise?: number;
  franchises?: number[];
  game_engines?: number[];
  game_localizations?: number[];
  game_modes?: number[];
  game_status?: number;
  game_type?: number;
  genres?: number[];
  hypes?: number;
  involved_companies?: number[];
  keywords?: number[];
  language_supports?: number[];
  multiplayer_modes?: number[];
  platforms?: number[];
  player_perspectives?: number[];
  ports?: number[];
  rating?: number;
  rating_count?: number;
  release_dates?: number[];
  remakes?: number[];
  remasters?: number[];
  screenshots?: number[];
  similar_games?: number[];
  slug: string;
  standalone_expansions?: number[];
  storyline?: string;
  tags?: number[];
  themes?: number[];
  total_rating?: number;
  total_rating_count?: number;
  updated_at: number;
  url: string;
  version_parent?: number;
  version_title?: string;
  videos?: number[];
  websites?: number[];
}

// Api Docs: https://api-docs.igdb.com/
export class IGDBProvider implements MetadataProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string;
  private accessTokenExpiry: DateTime;

  constructor() {
    const client_id = process.env.IGDB_CLIENT_ID;
    if (!client_id)
      throw new MissingMetadataProviderConfig("IGDB_CLIENT_ID", this.name());
    const client_secret = process.env.IGDB_CLIENT_SECRET;
    if (!client_secret)
      throw new MissingMetadataProviderConfig(
        "IGDB_CLIENT_SECRET",
        this.name(),
      );

    this.clientId = client_id;
    this.clientSecret = client_secret;

    this.accessToken = "";
    this.accessTokenExpiry = DateTime.now().minus({
      year: 1,
    });
  }

  private async authWithTwitch() {
    logger.info("IGDB authorizing with twitch");
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
    });

    const response = await $fetch<TwitchAuthResponse>(
      `https://id.twitch.tv/oauth2/token?${params.toString()}`,
      {
        method: "POST",
      },
    );

    this.accessToken = response.access_token;
    this.accessTokenExpiry = DateTime.now().plus({
      seconds: response.expires_in,
    });

    logger.info("IGDB done authorizing with twitch");
  }

  private async refreshCredentials() {
    const futureTime = DateTime.now().plus({
      day: 1,
    });

    // if the token expires in less than a day
    if (this.accessTokenExpiry < futureTime) await this.authWithTwitch();
  }

  private async request<T extends object>(
    resource: string,
    body: string,
    options?: NitroFetchOptions<NitroFetchRequest, "post">,
  ) {
    await this.refreshCredentials();

    // prevent calling api before auth is complete
    if (this.accessToken.length <= 0)
      throw new Error(
        "IGDB either failed to authenticate, or has not done so yet",
      );

    const finalURL = `https://api.igdb.com/v4/${resource}`;

    const overlay: NitroFetchOptions<NitroFetchRequest, "post"> = {
      baseURL: "",
      method: "POST",
      body,
      headers: {
        Accept: "application/json",
        "Client-ID": this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "text/plain",
      },
    };
    const response = await $fetch<T[] | IGDBErrorResponse[]>(finalURL, {
      ...options,
      ...overlay,
    });

    // should not have an error object if the status code is 200
    return <T[]>response;
  }

  private async _getMediaInternal(
    mediaID: number,
    type: string,
    size: string = "t_thumb",
  ) {
    if (mediaID === undefined)
      throw new Error(
        `IGDB mediaID when getting item of type ${type} was undefined`,
      );

    const body = `where id = ${mediaID}; fields image_id;`;
    const response = await this.request<IGDBCover>(type, body);

    if (!response.length || !response[0]?.image_id) {
      throw new Error(`No image_id found for ${type} with id ${mediaID}`);
    }

    const imageId = response[0].image_id;
    const result = `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;

    return result;
  }

  private async getCoverURL(id: number) {
    return await this._getMediaInternal(id, "covers", "t_cover_big");
  }

  private async getArtworkURL(id: number) {
    return await this._getMediaInternal(id, "artworks", "t_1080p");
  }

  private async getScreenshotURL(id: number) {
    return await this._getMediaInternal(id, "screenshots", "t_1080p");
  }

  private async getIconURL(id: number) {
    return await this._getMediaInternal(id, "covers", "t_thumb");
  }

  private async getCompanyLogoURl(id: number) {
    return await this._getMediaInternal(id, "company_logos", "t_original");
  }

  private trimMessage(msg: string, len: number) {
    return msg.length > len ? msg.substring(0, 280) + "..." : msg;
  }

  private async _getGenreInternal(genreID: number) {
    if (genreID === undefined) throw new Error(`IGDB genreID was undefined`);

    const body = `where id = ${genreID}; fields slug,name,url;`;
    const response = await this.request<IGDBGenre>("genres", body);

    let result = "";

    response.forEach((genre) => {
      result = genre.name;
    });

    return result;
  }

  private async getGenres(genres: number[] | undefined): Promise<string[]> {
    if (genres === undefined) return [];

    const results: string[] = [];
    for (const genre of genres) {
      results.push(await this._getGenreInternal(genre));
    }

    return results;
  }

  name() {
    return "IGDB";
  }
  source() {
    return MetadataSource.IGDB;
  }

  async search(query: string): Promise<GameMetadataSearchResult[]> {
    const body = `search "${query}"; fields name,cover,first_release_date,summary; limit 3;`;
    const response = await this.request<IGDBSearchStub>("games", body);

    const results: GameMetadataSearchResult[] = [];
    for (const item of response) {
      let icon: string;
      const cover = item.cover;
      if (cover !== undefined) {
        icon = await this.getIconURL(cover);
      } else {
        icon = "";
      }

      const firstReleaseDate = item.first_release_date;
      results.push({
        id: "" + item.id,
        name: item.name,
        icon,
        description: item.summary,
        year:
          firstReleaseDate === undefined
            ? 0
            : DateTime.fromSeconds(firstReleaseDate).year,
      });
    }

    return results;
  }
  private async processGameImages(
    currentGame: IGDBGameFull,
    id: string,
    createObject: (data: string) => string,
    context?: TaskRunContext,
  ) {
    let iconRaw: string | Buffer, coverRaw: string | Buffer;
    const cover = currentGame.cover;
    if (cover !== undefined) {
      context?.logger.info("Found cover URL, using...");
      iconRaw = await this.getIconURL(cover);
      coverRaw = await this.getCoverURL(cover);
    } else {
      context?.logger.info("Missing cover URL, using fallback...");
      iconRaw = jdenticon.toPng(id, 512) as unknown as string;
      coverRaw = iconRaw;
    }

    const icon = createObject(iconRaw as string);
    const coverID = createObject(coverRaw as string);
    let banner: string | undefined;

    const images = [coverID];
    for (const art of currentGame.artworks ?? []) {
      const objectId = createObject(await this.getArtworkURL(art));
      if (!banner) banner = objectId;
      images.push(objectId);
    }

    if (!banner) {
      banner = createObject(jdenticon.toPng(id, 512) as unknown as string);
    }

    for (const screenshot of currentGame.screenshots ?? []) {
      const objectId = createObject(await this.getScreenshotURL(screenshot));
      images.push(objectId);
    }

    return { icon, coverID, banner, images };
  }

  private async processCompanyData(
    companyData: { name: string },
    company: (name: string) => Promise<CompanyModel | undefined>,
    foundInvolved: { developer: boolean; publisher: boolean },
    context?: TaskRunContext,
  ): Promise<CompanyModel | undefined> {
    context?.logger.info(
      `Found involved company "${companyData.name}" as: ${foundInvolved.developer ? "developer, " : ""}${foundInvolved.publisher ? "publisher" : ""}`,
    );

    const res = await company(companyData.name);
    if (res === undefined) {
      context?.logger.warn(`Failed to import company "${companyData.name}"`);
      return undefined;
    }

    return res;
  }

  private async processInvolvedCompanyEntry(
    foundInvolved: IGDBInvolvedCompany,
    company: (name: string) => Promise<CompanyModel | undefined>,
    context?: TaskRunContext,
  ): Promise<{ developers: CompanyModel[]; publishers: CompanyModel[] }> {
    const developers: CompanyModel[] = [];
    const publishers: CompanyModel[] = [];
    const companies = await this.request<{ name: string } & IGDBItem>(
      "companies",
      `where id = ${foundInvolved.company}; fields name;`,
    );

    for (const companyData of companies) {
      const res = await this.processCompanyData(
        companyData,
        company,
        foundInvolved,
        context,
      );
      if (!res) continue;
      if (foundInvolved.developer) developers.push(res);
      if (foundInvolved.publisher) publishers.push(res);
    }

    return { developers, publishers };
  }

  private async processInvolvedCompanies(
    currentGame: IGDBGameFull,
    company: (name: string) => Promise<CompanyModel | undefined>,
    context?: TaskRunContext,
  ) {
    const publishers: CompanyModel[] = [];
    const developers: CompanyModel[] = [];

    for (const involvedCompany of currentGame.involved_companies ?? []) {
      const involved = await this.request<IGDBInvolvedCompany>(
        "involved_companies",
        `where id = ${involvedCompany}; fields *;`,
      );
      for (const foundInvolved of involved) {
        const { developers: devs, publishers: pubs } =
          await this.processInvolvedCompanyEntry(
            foundInvolved,
            company,
            context,
          );
        developers.push(...devs);
        publishers.push(...pubs);
      }
    }

    return { publishers, developers };
  }

  private buildGameDescription(currentGame: IGDBGameFull) {
    const { summary, storyline } = currentGame;
    let description: string;
    let shortDescription: string;

    if (summary.length > (storyline?.length ?? 0)) {
      description = summary;
      shortDescription = this.trimMessage(storyline ?? summary, 280);
    } else {
      description = storyline ?? summary;
      shortDescription = this.trimMessage(summary, 280);
    }

    return { description, shortDescription };
  }

  async fetchGame(
    { id, company, createObject }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    const body = `where id = ${id}; fields *;`;
    const currentGame = (await this.request<IGDBGameFull>("games", body)).at(0);
    if (!currentGame) throw new Error("No game found on IGDB with that id");

    context?.logger.info("Using IGDB provider.");

    const { icon, coverID, banner, images } = await this.processGameImages(
      currentGame,
      id,
      createObject,
      context,
    );
    context?.progress(20);

    const { publishers, developers } = await this.processInvolvedCompanies(
      currentGame,
      company,
      context,
    );
    context?.progress(80);

    const firstReleaseDate = currentGame.first_release_date;
    const released =
      firstReleaseDate === undefined
        ? new Date()
        : DateTime.fromSeconds(firstReleaseDate).toJSDate();

    const review = {
      metadataId: currentGame.id.toString(),
      metadataSource: MetadataSource.IGDB,
      mReviewCount: currentGame.total_rating_count ?? 0,
      mReviewRating: (currentGame.total_rating ?? 0) / 100,
      mReviewHref: currentGame.url,
    };

    const genres = await this.getGenres(currentGame.genres);

    const { description, shortDescription } =
      this.buildGameDescription(currentGame);

    const metadata = {
      id: currentGame.id.toString(),
      name: currentGame.name,
      shortDescription,
      description,
      released,

      genres,
      reviews: [review],

      publishers,
      developers,

      tags: [],

      icon,
      bannerId: banner,
      coverId: coverID,
      images,
    };

    context?.logger.info("IGDB provider finished.");
    context?.progress(100);

    return metadata;
  }
  async fetchCompany({
    query,
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata | undefined> {
    const response = await this.request<IGDBCompany>(
      "companies",
      `where name = "${query}"; fields *; limit 1;`,
    );

    for (const company of response) {
      const logo = createObject(await this.getCompanyLogoURl(company.logo));

      let company_url = "";
      for (const companySite of company.websites) {
        const companySiteRes = await this.request<IGDBCompanyWebsite>(
          "company_websites",
          `where id = ${companySite}; fields *;`,
        );

        for (const site of companySiteRes) {
          if (company_url.length <= 0) company_url = site.url;
        }
      }
      const metadata: CompanyMetadata = {
        id: "" + company.id,
        name: company.name,
        shortDescription: this.trimMessage(company.description, 280),
        description: company.description,
        website: company_url,

        logo: logo,
        banner: logo,
      };

      return metadata;
    }

    return undefined;
  }
}
