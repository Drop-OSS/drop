import type { Company } from "~/prisma/client";
import { MetadataSource } from "~/prisma/client";
import type { MetadataProvider } from ".";
import type {
  GameMetadataSearchResult,
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchCompanyMetadataParams,
  CompanyMetadata,
} from "./types";
import type { AxiosRequestConfig } from "axios";
import axios from "axios";
import * as jdenticon from "jdenticon";
import { DateTime } from "luxon";
import * as cheerio from "cheerio";

interface PCGamingWikiParseRawPage {
  parse: {
    title: string;
    pageid: number;
    revid: number;
    displaytitle: string;
    // array of links
    externallinks: string[];
    // array of wiki file names
    images: string[];
    text: {
      // rendered page contents
      "*": string;
    };
  };
}

interface PCGamingWikiParsedPage {
  shortIntro: string;
  introduction: string;
}

interface PCGamingWikiPage {
  PageID: string;
  PageName: string;
}

interface PCGamingWikiSearchStub extends PCGamingWikiPage {
  "Cover URL": string | null;
  Released: string | null;
  Released__precision: string | null;
}

interface PCGamingWikiGame extends PCGamingWikiSearchStub {
  Developers: string | string[] | null;
  Publishers: string | string[] | null;

  // TODO: save this somewhere, maybe a tag?
  Series: string | null;

  // tags
  Perspectives: string | string[] | null; // ie: First-person
  Genres: string | string[] | null; // ie: Action, FPS
  "Art styles": string | string[] | null; // ie: Stylized
  Themes: string | string[] | null; // ie: Post-apocalyptic, Sci-fi, Space
  Modes: string | string[] | null; // ie: Singleplayer, Multiplayer
  Pacing: string | string[] | null; // ie: Real-time
}

interface PCGamingWikiCompany extends PCGamingWikiPage {
  Parent: string | null;
  Founded: string | null;
  Website: string | null;
  Founded__precision: string | null;
  Defunct__precision: string | null;
}

interface PCGamingWikiCargoResult<T> {
  cargoquery: [
    {
      title: T;
    },
  ];
  error?: {
    code?: string;
    info?: string;
    errorclass?: string;
    "*"?: string;
  };
}

type StringArrayKeys<T> = {
  [K in keyof T]: T[K] extends string | string[] | null ? K : never;
}[keyof T];

// Api Docs: https://www.pcgamingwiki.com/wiki/PCGamingWiki:API
// Good tool for helping build cargo queries: https://www.pcgamingwiki.com/wiki/Special:CargoQuery
export class PCGamingWikiProvider implements MetadataProvider {
  name() {
    return "PCGamingWiki";
  }
  source() {
    return MetadataSource.PCGamingWiki;
  }

  private async request<T>(
    query: URLSearchParams,
    options?: AxiosRequestConfig,
  ) {
    const finalURL = `https://www.pcgamingwiki.com/w/api.php?${query.toString()}`;

    const overlay: AxiosRequestConfig = {
      url: finalURL,
      baseURL: "",
    };
    const response = await axios.request<T>(
      Object.assign({}, options, overlay),
    );

    if (response.status !== 200)
      throw new Error(
        `Error in pcgamingwiki \nStatus Code: ${response.status}`,
      );

    return response;
  }

  private async cargoQuery<T>(
    query: URLSearchParams,
    options?: AxiosRequestConfig,
  ) {
    const response = await this.request<PCGamingWikiCargoResult<T>>(
      query,
      options,
    );
    if (response.data.error !== undefined)
      throw new Error(`Error in pcgamingwiki cargo query`);
    return response;
  }

  private async getPageContent(
    pageID: string,
  ): Promise<PCGamingWikiParsedPage> {
    const searchParams = new URLSearchParams({
      action: "parse",
      format: "json",
      pageid: pageID,
    });
    const res = await this.request<PCGamingWikiParseRawPage>(searchParams);
    const $ = cheerio.load(res.data.parse.text["*"]);
    // get intro based on 'introduction' class
    const introductionEle = $(".introduction").first();
    // remove citations from intro
    introductionEle.find("sup").remove();

    return {
      shortIntro: introductionEle.find("p").first().text(),
      introduction: introductionEle.text(),
    };
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

    const res = await this.cargoQuery<PCGamingWikiSearchStub>(searchParams);

    const mapped = res.data.cargoquery.map((result) => {
      const game = result.title;

      const metadata: GameMetadataSearchResult = {
        id: game.PageID,
        name: game.PageName,
        icon: game["Cover URL"] ?? "",
        description: "", // TODO: need to render the `Introduction` template somehow (or we could just hardcode it)
        year:
          game.Released !== null && game.Released.length > 0
            ? // sometimes will provide multiple dates
              this.parseTS(game.Released).year
            : 0,
      };
      return metadata;
    });

    return mapped;
  }

  /**
   * Parses the specific format that the wiki returns when specifying an array
   * @param input string or array
   * @returns
   */
  private parseWikiStringArray(input: string | string[]): string[] {
    const cleanStr = (str: string): string => {
      // remove any dumb prefixes we don't care about
      return str.replace("Company:", "").trim();
    };

    // input can provides the string as a list
    // ie: "Company:Digerati Distribution,Company:Greylock Studio"
    // or as an array, sometimes the array has empty values

    const results: string[] = [];
    if (Array.isArray(input)) {
      input.forEach((c) => {
        const clean = cleanStr(c);
        if (clean !== "") results.push(clean);
      });
    } else {
      const items = input.split(",");
      items.forEach((item) => {
        const clean = cleanStr(item);
        if (clean !== "") results.push(clean);
      });
    }

    return results;
  }

  /**
   * Parses the specific format that the wiki returns when specifying a iso timestamp
   * @param isoStr
   * @returns
   */
  private parseTS(isoStr: string): DateTime {
    return DateTime.fromISO(isoStr.split(";")[0]);
  }

  private parseWebsitesGetFirst(websiteStr?: string | null): string {
    if (websiteStr === undefined || websiteStr === null) return "";

    // string comes in format: "[https://www.gamesci.com.cn www.gamesci.com.cn]"
    return websiteStr.replaceAll(/\[|]/g, "").split(" ")[0] ?? "";
  }

  private compileTags(game: PCGamingWikiGame): string[] {
    const results: string[] = [];

    const properties: StringArrayKeys<PCGamingWikiGame>[] = [
      "Art styles",
      "Genres",
      "Modes",
      "Pacing",
      "Perspectives",
      "Themes",
    ];

    // loop through all above keys, get the tags they contain
    properties.forEach((p) => {
      if (game[p] === null) return;

      results.push(...this.parseWikiStringArray(game[p]));
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
        "Infobox_game._pageID=PageID,Infobox_game._pageName=PageName,Infobox_game.Cover_URL,Infobox_game.Developers,Infobox_game.Released,Infobox_game.Genres,Infobox_game.Publishers,Infobox_game.Themes,Infobox_game.Series,Infobox_game.Modes,Infobox_game.Perspectives,Infobox_game.Art_styles,Infobox_game.Pacing",
      where: `Infobox_game._pageID="${id}"`,
      format: "json",
    });

    const [res, pageContent] = await Promise.all([
      this.cargoQuery<PCGamingWikiGame>(searchParams),
      this.getPageContent(id),
    ]);
    if (res.data.cargoquery.length < 1)
      throw new Error("Error in pcgamingwiki, no game");

    const game = res.data.cargoquery[0].title;

    const publishers: Company[] = [];
    if (game.Publishers !== null) {
      const pubListClean = this.parseWikiStringArray(game.Publishers);
      for (const pub of pubListClean) {
        const res = await publisher(pub);
        if (res === undefined) continue;
        publishers.push(res);
      }
    }

    const developers: Company[] = [];
    if (game.Developers !== null) {
      const devListClean = this.parseWikiStringArray(game.Developers);
      for (const dev of devListClean) {
        const res = await developer(dev);
        if (res === undefined) continue;
        developers.push(res);
      }
    }

    const icon =
      game["Cover URL"] !== null
        ? createObject(game["Cover URL"])
        : createObject(jdenticon.toPng(name, 512));

    const metadata: GameMetadata = {
      id: game.PageID,
      name: game.PageName,
      shortDescription: pageContent.shortIntro,
      description: pageContent.introduction,
      released: game.Released
        ? DateTime.fromISO(game.Released.split(";")[0]).toJSDate()
        : new Date(),

      tags: this.compileTags(game),

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

  async fetchCompany({
    query,
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata> {
    const searchParams = new URLSearchParams({
      action: "cargoquery",
      tables: "Company",
      fields:
        "Company.Parent,Company.Founded,Company.Defunct,Company.Website,Company._pageName=PageName,Company._pageID=PageID",
      where: `Company._pageName="Company:${query}"`,
      format: "json",
    });

    const res = await this.cargoQuery<PCGamingWikiCompany>(searchParams);

    // TODO: replace with company logo
    const icon = createObject(jdenticon.toPng(query, 512));

    for (let i = 0; i < res.data.cargoquery.length; i++) {
      const company = res.data.cargoquery[i].title;

      const fixedCompanyName =
        this.parseWikiStringArray(company.PageName)[0] ?? company.PageName;

      const metadata: CompanyMetadata = {
        id: company.PageID,
        name: fixedCompanyName,
        shortDescription: "",
        description: "",
        website: this.parseWebsitesGetFirst(company?.Website),

        logo: icon,
        banner: icon,
      };
      return metadata;
    }

    throw new Error(`pcgamingwiki failed to find publisher/developer ${query}`);
  }
}
