import { Developer, MetadataSource, Publisher } from "@prisma/client";
import { MetadataProvider, MissingMetadataProviderConfig } from ".";
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
import { inspect } from "util";
import moment from "moment";

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
  cover: IGDBID;
  first_release_date: number; // unix timestamp
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
  private client_id: string;
  private client_secret: string;
  private access_token: string;
  private access_token_expire: moment.Moment;

  constructor() {
    const client_id = process.env.IGDB_CLIENT_ID;
    if (!client_id)
      throw new MissingMetadataProviderConfig("IGDB_CLIENT_ID", this.name());
    const client_secret = process.env.IGDB_CLIENT_SECRET;
    if (!client_secret)
      throw new MissingMetadataProviderConfig(
        "IGDB_CLIENT_SECRET",
        this.name()
      );

    this.client_id = client_id;
    this.client_secret = client_secret;

    this.access_token = "";
    this.access_token_expire = moment();
    this.authWithTwitch();
  }

  private async authWithTwitch() {
    const params = new URLSearchParams({
      client_id: this.client_id,
      client_secret: this.client_secret,
      grant_type: "client_credentials",
    });

    const response = await axios.request<TwitchAuthResponse>({
      url: `https://id.twitch.tv/oauth2/token?${params.toString()}`,
      baseURL: "",
      method: "POST",
    });

    this.access_token = response.data.access_token;
    this.access_token_expire = moment().add(
      response.data.expires_in,
      "seconds"
    );
  }

  private async refreshCredentials() {
    const futureTime = moment().add(1, "day");

    // if the token expires before this future time (aka soon), refresh
    if (this.access_token_expire.isBefore(futureTime)) this.authWithTwitch();
  }

  private async request<T extends Object>(
    resource: string,
    body: string,
    options?: AxiosRequestConfig
  ) {
    await this.refreshCredentials();

    // prevent calling api before auth is complete
    if (this.access_token.length <= 0)
      throw new Error(
        "IGDB either failed to authenticate, or has not done so yet"
      );

    const finalURL = `https://api.igdb.com/v4/${resource}`;

    const overlay: AxiosRequestConfig = {
      url: finalURL,
      baseURL: "",
      method: "POST",
      data: body,
      headers: {
        Accept: "application/json",
        "Client-ID": this.client_id,
        Authorization: `Bearer ${this.access_token}`,
        "content-type": "text/plain",
      },
    };
    const response = await axios.request<T[] | IGDBErrorResponse[]>(
      Object.assign({}, options, overlay)
    );

    if (response.status !== 200) {
      let cause = "";

      response.data.forEach((item) => {
        if ("cause" in item) cause = item.cause;
      });

      throw new Error(
        `Error in igdb \nStatus Code: ${response.status} \nCause: ${cause}`
      );
    }

    // should not have an error object if the status code is 200
    return <T[]>response.data;
  }

  private async _getMediaInternal(mediaID: IGDBID, type: string) {
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

  id() {
    return "igdb";
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
      results.push({
        id: "" + response[i].id,
        name: response[i].name,
        icon: await this.getCoverURL(response[i].cover),
        description: response[i].summary,
        year: moment.unix(response[i].first_release_date).year(),
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
      const icon = createObject(await this.getCoverURL(response[i].cover));
      let banner = "";

      const images = [icon];
      for (const art of response[i]?.artworks ?? []) {
        // if banner not set
        if (banner.length <= 0) {
          banner = createObject(await this.getArtworkURL(art));
          images.push(banner);
        } else {
          images.push(createObject(await this.getArtworkURL(art)));
        }
      }

      const publishers: Publisher[] = [];
      const developers: Developer[] = [];
      for (const involvedCompany of response[i]?.involved_companies ?? []) {
        // get details about the involved company
        const involved_company_response =
          await this.request<IGDBInvolvedCompany>(
            "involved_companies",
            `where id = ${involvedCompany}; fields *;`
          );
        for (const foundInvolved of involved_company_response) {
          // now we need to get the actual company so we can get the name
          const findCompanyResponse = await this.request<
            { name: string } & IGDBItem
          >("companies", `where id = ${foundInvolved.company}; fields name;`);

          for (const company of findCompanyResponse) {
            // if company was a dev or publisher
            // CANNOT use else since a company can be both
            if (foundInvolved.developer)
              developers.push(await developer(company.name));
            if (foundInvolved.publisher)
              publishers.push(await publisher(company.name));
          }
        }
      }

      return {
        id: "" + response[i].id,
        name: response[i].name,
        shortDescription: this.trimMessage(response[i].summary, 280),
        description: response[i].summary,
        released: moment.unix(response[i].first_release_date).toDate(),

        reviewCount: response[i]?.total_rating_count ?? 0,
        reviewRating: (response[i]?.total_rating ?? 0) / 100,

        publishers: [],
        developers: [],

        icon,
        bannerId: banner,
        coverId: icon,
        images,
      };
    }

    throw new Error("No game found on igdb with that id");
  }
  async fetchPublisher({
    query,
    createObject,
  }: _FetchPublisherMetadataParams): Promise<PublisherMetadata> {
    const response = await this.request<IGDBCompany>(
      "companies",
      `where name = "${query}"; fields *; limit 1;`
    );

    for (const company of response) {
      const logo = createObject(await this.getCompanyLogoURl(company.logo));

      let company_url = "";
      for (const companySite of company.websites) {
        const companySiteRes = await this.request<IGDBCompanyWebsite>(
          "company_websites",
          `where id = ${companySite}; fields *;`
        );

        for (const site of companySiteRes) {
          if (company_url.length <= 0) company_url = site.url;
        }
      }
      const metadata: PublisherMetadata = {
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

    throw new Error("No results found");
  }
  async fetchDeveloper(
    params: _FetchDeveloperMetadataParams
  ): Promise<DeveloperMetadata> {
    return await this.fetchPublisher(params);
  }
}
