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
import * as jdenticon from "jdenticon";

interface PCGamingWikiPage {
  PageID: string;
  PageName: string;
}

interface PCGamingWikiSearchStub extends PCGamingWikiPage {
  "Cover URL"?: string;
  Released?: string;
  Released__precision?: string;
}

interface PCGamingWikiGame extends PCGamingWikiSearchStub {
  Developers?: string;
  Genres?: string;
  Publishers?: string;
  Themes?: string;
  Series?: string;
  Modes?: string;
}

interface PCGamingWikiCompany extends PCGamingWikiPage {
  Parent?: string;
  Founded?: string;
  Website?: string;
  Founded__precision?: string;
  Defunct__precision?: string;
}

interface PCGamingWikiCargoResult<T> {
  cargoquery: [
    {
      title: T;
    }
  ];
  error?: {
    code?: string;
    info?: string;
    errorclass?: string;
    "*"?: string;
  };
}

// Api Docs: https://www.pcgamingwiki.com/wiki/PCGamingWiki:API
// Good tool for helping build cargo queries: https://www.pcgamingwiki.com/wiki/Special:CargoQuery
export class PCGamingWikiProvider implements MetadataProvider {
  constructor() {}

  id() {
    return "pcgamingwiki";
  }
  name() {
    return "PCGamingWiki";
  }
  source() {
    return MetadataSource.PCGamingWiki;
  }

  private async request<T>(
    query: URLSearchParams,
    options?: AxiosRequestConfig
  ) {
    const finalURL = `https://www.pcgamingwiki.com/w/api.php?${query.toString()}`;

    const overlay: AxiosRequestConfig = {
      url: finalURL,
      baseURL: "",
    };
    const response = await axios.request<PCGamingWikiCargoResult<T>>(
      Object.assign({}, options, overlay)
    );

    if (response.status !== 200)
      throw new Error(
        `Error in pcgamingwiki \nStatus Code: ${response.status}`
      );
    else if (response.data.error !== undefined)
      throw new Error(`Error in pcgamingwiki, malformed query`);

    return response;
  }

  private markNullUndefined<T extends Record<string, any>>(obj: T): T {
    // TODO: fix types above and make everything nullable instead of possibly undefined, better then this, maybe?

    const result = structuredClone(obj);
    for (const [key, value] of Object.entries(result)) {
      if (value === null) delete result[key];
    }
    return result;
  }

  async search(query: string) {
    const searchParams = new URLSearchParams({
      action: "cargoquery",
      tables: "Infobox_game",
      fields:
        "Infobox_game._pageID=PageID,Infobox_game._pageName=PageName,Infobox_game.Cover_URL,Infobox_game.Released",
      where: `Infobox_game._pageName="${query}"`,
      format: "json",
    });

    const res = await this.request<PCGamingWikiSearchStub>(searchParams);

    const mapped = res.data.cargoquery.map((result) => {
      const game = this.markNullUndefined(result.title);

      const metadata: GameMetadataSearchResult = {
        id: game.PageID,
        name: game.PageName,
        icon: game["Cover URL"] ?? "",
        description: "", // TODO: need to render the `Introduction` template somehow (or we could just hardcode it)
        year:
          game.Released !== undefined && game.Released.length > 0
            ? moment(game.Released).year()
            : 0,
      };
      return metadata;
    });

    return mapped;
  }

  /**
   * Parses the specific format that the wiki returns when specifying a company
   * @param companyStr
   * @returns
   */
  private parseCompanyStr(companyStr: string): string[] {
    const results: string[] = [];
    // provides the string as a list of companies
    // ie: "Company:Digerati Distribution,Company:Greylock Studio"
    const items = companyStr.split(",");

    items.forEach((item) => {
      // remove the `Company:` and trim and whitespace
      results.push(item.replace("Company:", "").trim());
    });

    return results;
  }

  async fetchGame({
    id,
    name,
    publisher,
    developer,
    createObject,
  }: _FetchGameMetadataParams): Promise<GameMetadata> {
    const searchParams = new URLSearchParams({
      action: "cargoquery",
      tables: "Infobox_game",
      fields:
        "Infobox_game._pageID=PageID,Infobox_game._pageName=PageName,Infobox_game.Cover_URL,Infobox_game.Developers,Infobox_game.Released,Infobox_game.Genres,Infobox_game.Publishers,Infobox_game.Themes,Infobox_game.Series,Infobox_game.Modes",
      where: `Infobox_game._pageID="${id}"`,
      format: "json",
    });

    const res = await this.request<PCGamingWikiGame>(searchParams);
    if (res.data.cargoquery.length < 1)
      throw new Error("Error in pcgamingwiki, no game");

    const game = res.data.cargoquery[0].title;

    const publishers: Publisher[] = [];
    if (game.Publishers !== undefined) {
      const pubListClean = this.parseCompanyStr(game.Publishers);
      for (const pub of pubListClean) {
        console.log("Found publisher: ", pub);
        publishers.push(await publisher(pub));
      }
    }

    const developers: Developer[] = [];
    if (game.Developers !== undefined) {
      const devListClean = this.parseCompanyStr(game.Developers);
      for (const dev of devListClean) {
        console.log("Found dev: ", dev);
        developers.push(await developer(dev.replace("Company:", "")));
      }
    }

    const icon =
      game["Cover URL"] !== undefined
        ? createObject(game["Cover URL"])
        : createObject(jdenticon.toPng(name, 512));

    const metadata: GameMetadata = {
      id: game.PageID,
      name: game.PageName,
      shortDescription: "", // TODO: (again) need to render the `Introduction` template somehow (or we could just hardcode it)
      description: "",
      released:
        game.Released !== undefined
          ? moment(game.Released).toDate()
          : new Date(),

      reviewCount: 0,
      reviewRating: 0,

      publishers,
      developers,

      icon: icon,
      bannerId: icon,
      coverId: icon,
      images: [icon],
    };

    return metadata;
  }

  async fetchPublisher({
    query,
    createObject,
  }: _FetchPublisherMetadataParams): Promise<PublisherMetadata> {
    const searchParams = new URLSearchParams({
      action: "cargoquery",
      tables: "Company",
      fields:
        "Company.Parent,Company.Founded,Company.Defunct,Company.Website,Company._pageName=PageName,Company._pageID=pageID",
      where: `Company._pageName="Company:${query}"`,
      format: "json",
    });

    console.log("Searching for: " + query);
    const res = await this.request<PCGamingWikiCompany>(searchParams);

    // TODO: replace
    const icon = createObject(jdenticon.toPng(query, 512));

    console.log("Found: ", res.data.cargoquery);

    for (let i = 0; i < res.data.cargoquery.length; i++) {
      const company = this.markNullUndefined(res.data.cargoquery[i].title);

      const metadata: PublisherMetadata = {
        id: company.PageID,
        name: company.PageName,
        shortDescription: "",
        description: "",
        website: company?.Website ?? "",

        logo: icon,
        banner: icon,
      };
      return metadata;
    }

    throw new Error("Error in pcgamingwiki, no publisher");
  }

  async fetchDeveloper(
    params: _FetchDeveloperMetadataParams
  ): Promise<DeveloperMetadata> {
    return await this.fetchPublisher(params);
  }
}
