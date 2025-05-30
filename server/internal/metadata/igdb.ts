import type { Company } from "~/prisma/client";
import { MetadataSource } from "~/prisma/client";
import type { MetadataProvider } from ".";
import { MissingMetadataProviderConfig } from ".";
import type {
  GameMetadataSearchResult,
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchCompanyMetadataParams,
  CompanyMetadata,
} from "./types";
import type { AxiosRequestConfig } from "axios";
import axios from "axios";
import { DateTime } from "luxon";
import * as jdenticon from "jdenticon";

type IGDBID = number;

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
  id: IGDBID;
}

interface IGDBGenre extends IGDBItem {
  name: string;
  slug: string;
  url: string;
}

// denotes role a company had in a game
interface IGDBInvolvedCompany extends IGDBItem {
  company: IGDBID;
  game: IGDBID;

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
  logo: IGDBID;
  parent: IGDBID;
  slug: string;
  start_date: number;
  status: IGDBID;
  websites: IGDBID[];
}

interface IGDBCompanyWebsite extends IGDBItem {
  trusted: boolean;
  url: string;
}

interface IGDBCover extends IGDBItem {
  url: string;
}

interface IGDBSearchStub extends IGDBItem {
  name: string;
  cover?: IGDBID;
  first_release_date?: number; // unix timestamp
  summary: string;
}

// https://api-docs.igdb.com/?shell#game
interface IGDBGameFull extends IGDBSearchStub {
  age_ratings?: IGDBID[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  alternative_names?: IGDBID[];
  artworks?: IGDBID[];
  bundles?: IGDBID[];
  checksum?: string;
  collections?: IGDBID[];
  created_at: number; // unix timestamp
  dlcs?: IGDBID[];
  expanded_games?: IGDBID[];
  expansions?: IGDBID[];
  external_games?: IGDBID[];
  forks?: IGDBID[];
  franchise?: IGDBID;
  franchises?: IGDBID[];
  game_engines?: IGDBID[];
  game_localizations?: IGDBID[];
  game_modes?: IGDBID[];
  game_status?: IGDBID;
  game_type?: IGDBID;
  genres?: IGDBID[];
  hypes?: number;
  involved_companies?: IGDBID[];
  keywords?: IGDBID[];
  language_supports?: IGDBID[];
  multiplayer_modes?: IGDBID[];
  platforms?: IGDBID[];
  player_perspectives?: IGDBID[];
  ports?: IGDBID[];
  rating?: number;
  rating_count?: number;
  release_dates?: IGDBID[];
  remakes?: IGDBID[];
  remasters?: IGDBID[];
  screenshots?: IGDBID[];
  similar_games?: IGDBID[];
  slug: string;
  standalone_expansions?: IGDBID[];
  storyline?: string;
  tags?: IGDBID[];
  themes?: IGDBID[];
  total_rating?: number;
  total_rating_count?: number;
  updated_at: number;
  url: string;
  version_parent?: IGDBID;
  version_title?: string;
  videos?: IGDBID[];
  websites?: IGDBID[];
}

// Api Docs: https://api-docs.igdb.com/
export class IGDBProvider implements MetadataProvider {
  private clientId: string;
  private clientSecret: string;
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
    console.log("IGDB authorizing with twitch");
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
    });

    const response = await axios.request<TwitchAuthResponse>({
      url: `https://id.twitch.tv/oauth2/token?${params.toString()}`,
      baseURL: "",
      method: "POST",
    });

    if (response.status !== 200)
      throw new Error(
        `Error in IDGB \nStatus Code: ${response.status}\n${response.data}`,
      );

    this.accessToken = response.data.access_token;
    this.accessTokenExpiry = DateTime.now().plus({
      seconds: response.data.expires_in,
    });

    console.log("IDGB done authorizing with twitch");
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
    options?: AxiosRequestConfig,
  ) {
    await this.refreshCredentials();

    // prevent calling api before auth is complete
    if (this.accessToken.length <= 0)
      throw new Error(
        "IGDB either failed to authenticate, or has not done so yet",
      );

    const finalURL = `https://api.igdb.com/v4/${resource}`;

    const overlay: AxiosRequestConfig = {
      url: finalURL,
      baseURL: "",
      method: "POST",
      data: body,
      headers: {
        Accept: "application/json",
        "Client-ID": this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "text/plain",
      },
    };
    const response = await axios.request<T[] | IGDBErrorResponse[]>(
      Object.assign({}, options, overlay),
    );

    if (response.status !== 200) {
      let cause = "";

      response.data.forEach((item) => {
        if ("cause" in item) cause = item.cause;
      });

      throw new Error(
        `Error in igdb \nStatus Code: ${response.status} \nCause: ${cause}`,
      );
    }

    // should not have an error object if the status code is 200
    return <T[]>response.data;
  }

  private async _getMediaInternal(mediaID: IGDBID, type: string) {
    if (mediaID === undefined)
      throw new Error(
        `IGDB mediaID when getting item of type ${type} was undefined`,
      );

    const body = `where id = ${mediaID}; fields url;`;
    const response = await this.request<IGDBCover>(type, body);

    let result = "";

    response.forEach((cover) => {
      if (cover.url.startsWith("https:")) {
        result = cover.url;
      } else {
        // twitch *sometimes* provides it in the format "//images.igdb.com"
        result = `https:${cover.url}`;
      }
    });

    return result;
  }

  private async getCoverURL(id: IGDBID) {
    return await this._getMediaInternal(id, "covers");
  }

  private async getArtworkURL(id: IGDBID) {
    return await this._getMediaInternal(id, "artworks");
  }

  private async getCompanyLogoURl(id: IGDBID) {
    return await this._getMediaInternal(id, "company_logos");
  }

  private trimMessage(msg: string, len: number) {
    return msg.length > len ? msg.substring(0, 280) + "..." : msg;
  }

  private async _getGenreInternal(genreID: IGDBID) {
    if (genreID === undefined) throw new Error(`IGDB genreID was undefined`);

    const body = `where id = ${genreID}; fields slug,name,url;`;
    const response = await this.request<IGDBGenre>("genres", body);

    let result = "";

    response.forEach((genre) => {
      result = genre.name;
    });

    return result;
  }

  private async getGenres(genres: IGDBID[] | undefined): Promise<string[]> {
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
    for (let i = 0; i < response.length; i++) {
      let icon = "";
      const cover = response[i].cover;
      if (cover !== undefined) {
        icon = await this.getCoverURL(cover);
      } else {
        icon = "";
      }

      const firstReleaseDate = response[i].first_release_date;
      results.push({
        id: "" + response[i].id,
        name: response[i].name,
        icon,
        description: response[i].summary,
        year:
          firstReleaseDate === undefined
            ? 0
            : DateTime.fromSeconds(firstReleaseDate).year,
      });
    }

    return results;
  }
  async fetchGame({
    id,
    publisher,
    developer,
    createObject,
  }: _FetchGameMetadataParams): Promise<GameMetadata> {
    const body = `where id = ${id}; fields *;`;
    const response = await this.request<IGDBGameFull>("games", body);

    for (let i = 0; i < response.length; i++) {
      const currentGame = response[i];
      if(!currentGame) continue;

      let iconRaw;
      const cover = currentGame.cover;
      if (cover !== undefined) {
        iconRaw = await this.getCoverURL(cover);
      } else {
        iconRaw = jdenticon.toPng(id, 512);
      }
      const icon = createObject(iconRaw);
      let banner = "";

      const images = [icon];
      for (const art of currentGame.artworks ?? []) {
        // if banner not set
        if (banner.length <= 0) {
          banner = createObject(await this.getArtworkURL(art));
          images.push(banner);
        } else {
          images.push(createObject(await this.getArtworkURL(art)));
        }
      }

      const publishers: Company[] = [];
      const developers: Company[] = [];
      for (const involvedCompany of currentGame.involved_companies ?? []) {
        // get details about the involved company
        const involved_company_response =
          await this.request<IGDBInvolvedCompany>(
            "involved_companies",
            `where id = ${involvedCompany}; fields *;`,
          );
        for (const foundInvolved of involved_company_response) {
          // now we need to get the actual company so we can get the name
          const findCompanyResponse = await this.request<
            { name: string } & IGDBItem
          >("companies", `where id = ${foundInvolved.company}; fields name;`);

          for (const company of findCompanyResponse) {
            // if company was a dev or publisher
            // CANNOT use else since a company can be both
            if (foundInvolved.developer) {
              const res = await developer(company.name);
              if (res === undefined) continue;
              developers.push(res);
            }
            if (foundInvolved.publisher) {
              const res = await publisher(company.name);
              if (res === undefined) continue;
              publishers.push(res);
            }
          }
        }
      }

      const firstReleaseDate = currentGame.first_release_date;

      return {
        id: "" + response[i].id,
        name: response[i].name,
        shortDescription: this.trimMessage(currentGame.summary, 280),
        description: currentGame.summary,
        released:
          firstReleaseDate === undefined
            ? new Date()
            : DateTime.fromSeconds(firstReleaseDate).toJSDate(),

        reviews: [
          {
            metadataId: "" + currentGame.id,
            metadataSource: MetadataSource.IGDB,
            mReviewCount: currentGame.total_rating_count ?? 0,
            mReviewRating: (currentGame.total_rating ?? 0) / 100,
            mReviewHref: currentGame.url,
          },
        ],

        publishers: [],
        developers: [],

        tags: await this.getGenres(currentGame.genres),

        icon,
        bannerId: banner,
        coverId: icon,
        images,
      };
    }

    throw new Error("No game found on igdb with that id");
  }
  async fetchCompany({
    query,
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata> {
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

    throw new Error(`igdb failed to find publisher/developer ${query}`);
  }
}
