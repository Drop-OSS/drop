import { MetadataSource } from "~/prisma/client/enums";
import type { MetadataProvider } from ".";
import type {
  GameMetadataSearchResult,
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchCompanyMetadataParams,
  CompanyMetadata,
  GameMetadataRating,
} from "./types";
import type { TaskRunContext } from "../tasks";
import axios from "axios";
import * as jdenticon from "jdenticon";

/**
 * Note: The Steam API is largely undocumented.
 * Helpful resources for reverse engineering and understanding endpoints:
 * - The GOAT xPaw: https://steamapi.xpaw.me/
 * - RJackson and the Team Fortress Community: https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI
 *
 * These community-driven resources provide valuable insights into Steam's internal APIs.
 *
 * Most Steam API endpoints accept a 'language' or 'l' query parameter for localization.
 * Some endpoints require a cc (country code) parameter to filter region-specific game availability.
 *
 * There is no public known endpoint for searching companies, so we scrape the developer page instead.
 * We're geussing the developer page by calling `https://store.steampowered.com/developer/{developer_name}/`.
 * This as a high chance of failing, because the developer name is not always the same as the URL slug.
 * Alternatively, we could use the link on a game's store page, but this redirects often to the publisher.
 */

interface SteamItem {
  appid: string;
}

interface SteamSearchStub extends SteamItem {
  name: string;
  icon: string; // Ratio 1:1
  logo: string; // Ratio 8:3
}

interface SteamAppDetailsSmall extends SteamItem {
  item_type: number;
  id: number;
  success: number;
  visible: boolean;
  name: string;
  store_url_path: string;
  type: number;
  categories: {
    supported_player_categoryids: number[];
    featured_categoryids: number[];
    controller_categoryids: number[];
  };
  basic_info: {
    short_description: string;
    publishers: {
      name: string;
      creator_clan_account_id: number;
    }[];
    developers: {
      name: string;
      creator_clan_account_id: number;
    }[];
    capsule_headline: string;
  };
  release: {
    steam_release_date: number; // UNIX timestamp in seconds
  };
  best_purchase_option: {
    packageid: number;
    purchase_option_name: string;
    final_price_in_cents: string;
    formatted_final_price: string;
    usert_can_purchase_as_gift: boolean;
    hide_discount_pct_for_compliance: boolean;
    included_game_count: number;
  };
}

interface SteamAppDetailsLarge extends SteamAppDetailsSmall {
  tagids: number[];
  reviews: {
    summary_filtered: {
      review_count: number;
      percent_positive: number;
      review_score: number;
      review_score_label: string;
    };
    summary_language_specific: {
      review_count: number;
      percent_positive: number;
      review_score: number;
      review_score_label: string;
    }[];
  };
  tags: {
    tagid: number;
    weight: number;
  }[];
  assets: {
    asset_url_format: string;
    main_capsule: string;
    small_capsule: string;
    header: string;
    page_background: string;
    hero_capsule: string;
    library_capsule: string;
    library_capsule_2x: string;
    library_hero: string;
    community_icon: string;
    page_background_path: string;
    raw_page_background: string;
  };
  screenshots: {
    all_ages_screenshots: {
      filename: string;
      ordinal: number;
    }[];
  };
  full_description: string;
}

interface SteamAppDetailsPackage {
  response: {
    store_items: SteamAppDetailsSmall[] | SteamAppDetailsLarge[];
  };
}

interface SteamTags {
  tagid: number;
  name: string;
}

interface SteamTagsPackage {
  response: {
    version_hash: string;
    tags: SteamTags[];
  };
}

interface SteamWebAppDetailsSmall {
  type: string;
  name: string;
  steam_appid: number;
  required_age: string;
  is_free: boolean;
  dlc: number[];
  detailed_description: string;
  about_the_game: string;
  short_description: string;
  supported_languages: string;
  header_image: string;
  capsule_image: string;
  capsule_imagev5: string;
  website: string;
  pc_requirements: { minimum: string; recommended: string };
  mac_requirements: { minimum: string; recommended: string };
  linux_requirements: { minimum: string; recommended: string };
  legal_notice: string;
}

interface SteamWebAppDetailsLarge extends SteamWebAppDetailsSmall {
  metacritic: {
    score: number;
    url: string;
  };
}

interface SteamWebAppDetailsPackage {
  [key: string]: {
    success: boolean;
    data: SteamWebAppDetailsSmall | SteamWebAppDetailsLarge;
  };
}

export class SteamProvider implements MetadataProvider {
  name() {
    return "Steam";
  }

  source(): MetadataSource {
    return MetadataSource.Steam;
  }

  async search(query: string): Promise<GameMetadataSearchResult[]> {
    const response = await axios.get<SteamSearchStub[]>(
      `https://steamcommunity.com/actions/SearchApps/${query}`,
    );

    if (
      response.status !== 200 ||
      !response.data ||
      response.data.length === 0
    ) {
      return [];
    }

    const result: GameMetadataSearchResult[] = response.data.map((item) => ({
      id: item.appid,
      name: item.name,
      icon: item.icon || "",
      description: "",
      year: 0,
    }));

    const ids = response.data.map((i) => i.appid);

    const detailsResponse = await this._fetchGameDetails(ids, {
      include_basic_info: true,
      include_release: true,
    });

    const detailsMap = new Map<string, SteamAppDetailsSmall>();
    for (const item of detailsResponse) {
      detailsMap.set(item.appid.toString(), item);
    }

    for (const resItem of result) {
      const details = detailsMap.get(resItem.id);

      if (!details) continue;
      resItem.description = details.basic_info.short_description || "";

      if (!details.release?.steam_release_date) continue;
      const date = new Date(details.release.steam_release_date * 1000);
      resItem.year = date.getFullYear();
    }

    return result;
  }

  async fetchGame(
    { id, publisher, developer, createObject }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    context?.logger.info(`Starting Steam metadata fetch for game ID: ${id}`);
    context?.progress(0);

    context?.logger.info("Fetching game details from Steam API...");
    const response = await this._fetchGameDetails([id], {
      include_assets: true,
      include_basic_info: true,
      include_release: true,
      include_screenshots: true,
      include_tag_count: 100,
      include_full_description: true,
      include_reviews: true,
    });

    if (response.length === 0) {
      context?.logger.error(`No game found on Steam with ID: ${id}`);
      throw new Error(`No game found on Steam with id: ${id}`);
    }

    const currentGame = response[0] as SteamAppDetailsLarge;

    context?.logger.info(`Found game: "${currentGame.name}" on Steam`);
    context?.progress(10);

    context?.logger.info("Processing game images and assets...");
    const { icon, cover, banner, images } = this._processImages(
      currentGame,
      createObject,
      context,
    );

    const released = currentGame.release?.steam_release_date
      ? new Date(currentGame.release.steam_release_date * 1000)
      : new Date();

    if (currentGame.release?.steam_release_date) {
      context?.logger.info(`Release date: ${released.toLocaleDateString()}`);
    } else {
      context?.logger.warn(
        "No release date found, using current date as fallback",
      );
    }

    context?.progress(60);

    context?.logger.info(
      `Fetching tags from Steam (${currentGame.tagids?.length || 0} tags to process)...`,
    );
    const tags = await this._getTagNames(currentGame.tagids || []);

    context?.logger.info(
      `Successfully fetched ${tags.length} tags: ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`,
    );
    context?.progress(70);

    context?.logger.info("Processing publishers and developers...");
    const publishers = [];
    const publisherNames = currentGame.basic_info.publishers || [];
    context?.logger.info(
      `Found ${publisherNames.length} publisher(s) to process`,
    );

    for (const pub of publisherNames) {
      context?.logger.info(`Processing publisher: "${pub.name}"`);
      const comp = await publisher(pub.name);
      if (!comp) {
        context?.logger.warn(`Failed to import publisher "${pub.name}"`);
        continue;
      }
      publishers.push(comp);
      context?.logger.info(`Successfully imported publisher: "${pub.name}"`);
    }

    const developers = [];
    const developerNames = currentGame.basic_info.developers || [];
    context?.logger.info(
      `Found ${developerNames.length} developer(s) to process`,
    );

    for (const dev of developerNames) {
      context?.logger.info(`Processing developer: "${dev.name}"`);
      const comp = await developer(dev.name);
      if (!comp) {
        context?.logger.warn(`Failed to import developer "${dev.name}"`);
        continue;
      }
      developers.push(comp);
      context?.logger.info(`Successfully imported developer: "${dev.name}"`);
    }

    context?.logger.info(
      `Company processing complete: ${publishers.length} publishers, ${developers.length} developers`,
    );
    context?.progress(80);

    context?.logger.info("Fetching detailed description and reviews...");
    const webAppDetails = (await this._getWebAppDetails(
      id,
      "metacritic",
    )) as SteamWebAppDetailsLarge;

    const detailedDescription =
      webAppDetails?.detailed_description ||
      webAppDetails?.about_the_game ||
      "";

    let description;
    if (detailedDescription) {
      context?.logger.info("Converting HTML description to Markdown...");
      const converted = this._htmlToMarkdown(detailedDescription, createObject);
      images.push(...converted.objects);
      description = converted.markdown;
      context?.logger.info(
        `Description converted, ${converted.objects.length} images embedded`,
      );
    } else {
      context?.logger.info("Using fallback description from basic game info");
      description = currentGame.full_description;
    }

    context?.progress(90);

    context?.logger.info("Processing review ratings...");
    const reviews = [
      {
        metadataId: id,
        metadataSource: MetadataSource.Steam,
        mReviewCount: currentGame.reviews?.summary_filtered?.review_count || 0,
        mReviewHref: `https://store.steampowered.com/app/${id}`,
        mReviewRating:
          (currentGame.reviews?.summary_filtered?.percent_positive || 0) / 100,
      },
    ] as GameMetadataRating[];

    const steamReviewCount =
      currentGame.reviews?.summary_filtered?.review_count || 0;
    const steamRating =
      currentGame.reviews?.summary_filtered?.percent_positive || 0;
    context?.logger.info(
      `Steam reviews: ${steamReviewCount} reviews, ${steamRating}% positive`,
    );

    if (webAppDetails?.metacritic) {
      reviews.push({
        metadataId: id,
        metadataSource: MetadataSource.Metacritic,
        mReviewCount: 0,
        mReviewHref: webAppDetails.metacritic.url,
        mReviewRating: webAppDetails.metacritic.score / 100,
      });
      context?.logger.info(
        `Metacritic score: ${webAppDetails.metacritic.score}/100`,
      );
    }

    context?.logger.info(
      `Review processing complete: ${reviews.length} rating sources found`,
    );
    context?.progress(100);

    context?.logger.info("Steam metadata fetch completed successfully!");

    return {
      id: currentGame.appid.toString(),
      name: currentGame.name,
      shortDescription: currentGame.basic_info.short_description || "",
      description,
      released,
      publishers,
      developers,
      tags,
      reviews,
      icon,
      bannerId: banner,
      coverId: cover,
      images,
    } as GameMetadata;
  }

  async fetchCompany({
    query,
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata | undefined> {
    const searchParams = new URLSearchParams({
      l: "english",
    });

    const response = await axios.get(
      `https://store.steampowered.com/developer/${query.replaceAll(" ", "")}/?${searchParams.toString()}`,
      {
        maxRedirects: 0,
      },
    );

    if (response.status !== 200 || !response.data) {
      return undefined;
    }

    const html = response.data;

    // Extract metadata from HTML meta tags
    const metadata = this._extractMetaTagsFromHtml(html);

    if (!metadata.title) {
      return undefined;
    }

    // Extract company name from title (format: "Steam Developer: CompanyName")
    const companyName = metadata.title
      .replace(/^Steam Developer:\s*/i, "")
      .trim();

    if (!companyName) {
      return undefined;
    }

    let logoRaw;
    if (metadata.image) {
      logoRaw = metadata.image;
    } else {
      logoRaw = jdenticon.toPng(companyName, 512);
    }

    const logo = createObject(logoRaw);

    let bannerRaw;
    if (metadata.banner) {
      bannerRaw = metadata.banner;
    } else {
      bannerRaw = jdenticon.toPng(companyName, 512);
    }

    const banner = createObject(bannerRaw);

    return {
      id: query.replaceAll(" ", ""),
      name: companyName,
      shortDescription: metadata.description || "",
      description: "",
      logo,
      banner,
      website:
        metadata.url ||
        `https://store.steampowered.com/developer/${query.replaceAll(" ", "")}`,
    } as CompanyMetadata;
  }

  private _extractMetaTagsFromHtml(html: string): {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    banner?: string;
  } {
    const metadata: {
      title?: string;
      description?: string;
      image?: string;
      url?: string;
      banner?: string;
    } = {};

    const title = this._extractTitle(html);
    if (title) metadata.title = title;

    const description = this._extractDescription(html);
    if (description) metadata.description = description;

    const image = this._extractImage(html);
    if (image) metadata.image = image;

    const url = this._extractUrl(html);
    if (url) metadata.url = url;

    const banner = this._extractBanner(html);
    if (banner) metadata.banner = banner;

    return metadata;
  }

  private _extractTitle(html: string): string | undefined {
    const ogTitleRegex =
      /<meta\s+property\s*=\s*["']og:title["']\s+content\s*=\s*["']([^"']+)["']/i;
    const titleTagRegex = /<title[^>]*>([^<]+)<\/title>/i;

    let titleMatch = ogTitleRegex.exec(html);
    titleMatch ??= titleTagRegex.exec(html);

    return titleMatch ? this._decodeHtmlEntities(titleMatch[1]) : undefined;
  }

  private _extractDescription(html: string): string | undefined {
    const ogDescRegex =
      /<meta\s+property\s*=\s*"(?:og:description|twitter:description)"\s+content\s*=\s*"([^"]+)"\s*\/?>/i;
    const nameDescRegex =
      /<meta\s+name\s*=\s*"(?:Description|description)"\s+content\s*=\s*"([^"]+)"\s*\/?>/i;

    let descMatch = ogDescRegex.exec(html);
    descMatch ??= nameDescRegex.exec(html);

    return descMatch ? this._decodeHtmlEntities(descMatch[1]) : undefined;
  }

  private _extractImage(html: string): string | undefined {
    const ogImageRegex =
      /<meta\s+property\s*=\s*["'](?:og:image|twitter:image)["']\s+content\s*=\s*["']([^"']+)["']/i;
    const imageSrcRegex =
      /<link\s+rel\s*=\s*["']image_src["']\s+href\s*=\s*["']([^"']+)["']/i;

    let imageMatch = ogImageRegex.exec(html);
    imageMatch ??= imageSrcRegex.exec(html);

    return imageMatch ? imageMatch[1] : undefined;
  }

  private _extractUrl(html: string): string | undefined {
    const curatorUrlRegex =
      /<a[^>]*class\s*=\s*["'][^"']*curator_url[^"']*["'][^>]*href\s*=\s*["']https:\/\/steamcommunity\.com\/linkfilter\/\?u=([^"'&]+)["']/i;
    const linkfilterRegex =
      /<a[^>]*href\s*=\s*["']https:\/\/steamcommunity\.com\/linkfilter\/\?u=([^"'&]+)["'][^>]*(?:target=["']_blank["']|rel=["'][^"']*["'])/i;

    let curatorUrlMatch = curatorUrlRegex.exec(html);
    curatorUrlMatch ??= linkfilterRegex.exec(html);

    if (!curatorUrlMatch) return undefined;

    try {
      return decodeURIComponent(curatorUrlMatch[1]);
    } catch {
      return curatorUrlMatch[1];
    }
  }

  private _extractBanner(html: string): string | undefined {
    const bannerRegex =
      /background-image:\s*url\(['"]([^'"]*(?:\/clan\/\d+|\/app\/\d+|background|header)[^'"]*)\??[^'"]*['"][^}]*\)/i;
    const backgroundImageRegex =
      /style\s*=\s*["'][^"']*background-image:\s*url\(([^)]+)\)[^"']*/i;

    let bannerMatch = bannerRegex.exec(html);
    bannerMatch ??= backgroundImageRegex.exec(html);

    if (!bannerMatch) return undefined;

    let bannerUrl = bannerMatch[1].replace(/['"]/g, "");
    // Clean up the URL
    if (bannerUrl.includes("?")) {
      bannerUrl = bannerUrl.split("?")[0];
    }
    return bannerUrl;
  }

  private _decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  private async _fetchGameDetails(
    gameIds: string[],
    dataRequest: object,
    language = "english",
    country_code = "US",
  ): Promise<SteamAppDetailsSmall[] | SteamAppDetailsLarge[]> {
    const searchParams = new URLSearchParams({
      input_json: JSON.stringify({
        ids: gameIds.map((id) => ({
          appid: parseInt(id),
        })),
        context: {
          language,
          country_code,
        },
        data_request: dataRequest,
      }),
    });

    const request = await axios.get<SteamAppDetailsPackage>(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?${searchParams.toString()}`,
    );

    if (request.status !== 200) return [];

    const result = [];
    const storeItems = request.data?.response?.store_items ?? [];

    for (const item of storeItems) {
      if (item.success !== 1) continue;
      result.push(item);
    }

    return result;
  }

  private _processImages(
    game: SteamAppDetailsLarge,
    createObject: (input: string | Buffer) => string,
    context?: TaskRunContext,
  ): { icon: string; cover: string; banner: string; images: string[] } {
    const imageURLFormat = game.assets?.asset_url_format;

    context?.logger.info("Processing game icon...");
    let iconRaw;
    if (game.assets?.community_icon) {
      context?.logger.info("Found community icon on Steam");
      iconRaw = `https://cdn.fastly.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.assets.community_icon}.jpg`;
    } else {
      context?.logger.info("No icon found, generating fallback icon");
      iconRaw = jdenticon.toPng(game.appid, 512);
    }

    const icon = createObject(iconRaw);
    context?.progress(20);

    context?.logger.info("Processing game cover art...");
    let coverRaw;
    if (game.assets?.library_capsule_2x) {
      context?.logger.info("Found high-resolution cover art");
      coverRaw = this._getImageUrl(
        game.assets.library_capsule_2x,
        imageURLFormat,
      );
    } else if (game.assets?.library_capsule) {
      context?.logger.info("Found standard resolution cover art");
      coverRaw = this._getImageUrl(game.assets.library_capsule, imageURLFormat);
    } else {
      context?.logger.info("No cover art found, generating fallback cover");
      coverRaw = jdenticon.toPng(game.appid, 512);
    }

    const cover = createObject(coverRaw);
    context?.progress(30);

    context?.logger.info("Processing game banner...");
    let bannerRaw;
    if (game.assets?.library_hero) {
      context?.logger.info("Found library hero banner");
      bannerRaw = this._getImageUrl(game.assets.library_hero, imageURLFormat);
    } else {
      context?.logger.info("No banner found, generating fallback banner");
      bannerRaw = jdenticon.toPng(game.appid, 512);
    }

    const banner = createObject(bannerRaw);
    context?.progress(40);

    const images = [cover, banner];
    const screenshotCount = game.screenshots?.all_ages_screenshots?.length || 0;
    context?.logger.info(`Processing ${screenshotCount} screenshots...`);

    for (const image of game.screenshots?.all_ages_screenshots || []) {
      const imageUrl = this._getImageUrl(image.filename);
      images.push(createObject(imageUrl));
    }

    context?.logger.info(
      `Image processing complete: icon, cover, banner and ${screenshotCount} screenshots`,
    );
    context?.progress(50);

    return { icon, cover, banner, images };
  }

  private async _getTagNames(
    tagIds: number[],
    language = "english",
  ): Promise<string[]> {
    if (tagIds.length === 0) return [];

    const searchParams = new URLSearchParams({
      language,
    });

    const request = await axios.get<SteamTagsPackage>(
      `https://api.steampowered.com/IStoreService/GetTagList/v1/?${searchParams.toString()}`,
    );

    if (request.status !== 200 || !request.data.response?.tags) return [];

    const tagMap = new Map<number, string>();
    for (const tag of request.data.response.tags) {
      tagMap.set(tag.tagid, tag.name);
    }

    const result = [];
    for (const tagId of tagIds) {
      const tagName = tagMap.get(tagId);
      if (!tagName) continue;

      result.push(tagName);
    }

    return result;
  }

  private async _getWebAppDetails(
    appid: string,
    dataRequest: string, // Seperated by commas
    language = "english",
  ): Promise<SteamWebAppDetailsLarge | SteamWebAppDetailsSmall | undefined> {
    const searchParams = new URLSearchParams({
      appids: appid,
      filter: "basic," + dataRequest,
      l: language,
    });

    const request = await axios.get<SteamWebAppDetailsPackage>(
      `https://store.steampowered.com/api/appdetails?${searchParams.toString()}`,
    );

    if (request.status !== 200) {
      return undefined;
    }

    const appData = request.data[appid]?.data;
    if (!appData) {
      return undefined;
    }

    return appData;
  }

  private _getImageUrl(filename: string, format?: string): string {
    if (!filename || filename.trim().length === 0) return "";

    const url = "https://shared.fastly.steamstatic.com/store_item_assets/";

    if (format) {
      format = format.replace("${FILENAME}", filename);
      return url + format;
    }

    return url + filename;
  }

  private _htmlToMarkdown(
    html: string,
    createObject: (input: string | Buffer) => string,
  ): { markdown: string; objects: string[] } {
    if (!html || html.trim().length === 0) return { markdown: "", objects: [] };

    let markdown = html;
    const objects: string[] = [];
    const imageReplacements: { placeholder: string; imageId: string }[] = [];

    markdown = this._convertBasicHtmlElements(markdown);

    // Replace images with placheholders
    markdown = markdown.replace(
      /<img[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi,
      (match, src) => {
        const imageId = createObject(src);
        objects.push(imageId);
        const placeholder = `__IMG_${imageReplacements.length}__`;
        imageReplacements.push({ placeholder, imageId });
        return placeholder;
      },
    );

    markdown = this._convertRemainingHtmlElements(markdown);

    markdown = this._stripHtmlTags(markdown);

    markdown = this._cleanupBasicFormatting(markdown);

    markdown = this._processImagePlaceholders(markdown, imageReplacements);

    markdown = this._finalCleanup(markdown);

    return { markdown, objects };
  }

  private _convertBasicHtmlElements(markdown: string): string {
    // Remove HTML comments
    markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");

    // Convert the bullet points and tabs to markdown list format
    markdown = markdown.replace(/•\s*\t+/g, "\n- ");

    // Handle numbered enumeration (1.\t, 2.\t, etc.)
    markdown = markdown.replace(/(\d+)\.\s*\t+/g, "\n$1. ");

    // Convert bold text
    markdown = markdown.replace(
      /<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi,
      "**$2**",
    );

    // Convert headers (h1-h6) with Steam's bb_tag class
    markdown = markdown.replace(
      /<h([1-6])(?:\s+class="bb_tag")?[^>]*>(.*?)<\/h[1-6]>/gi,
      (_, level, content) => {
        const headerLevel = "#".repeat(parseInt(level));
        const cleanContent = this._stripHtmlTags(content).trim();
        return cleanContent ? `\n\n${headerLevel} ${cleanContent}\n\n` : "";
      },
    );

    return markdown;
  }

  private _convertRemainingHtmlElements(markdown: string): string {
    // Convert paragraphs with Steam's bb_paragraph class
    markdown = markdown.replace(
      /<p(?:\s+class="bb_paragraph")?[^>]*>(.*?)<\/p>/gi,
      (_, content) => {
        const cleanContent = this._stripHtmlTags(content).trim();
        return cleanContent ? `${cleanContent}` : "";
      },
    );

    // Convert unordered lists with Steam's bb_ul class
    markdown = markdown.replace(
      /<ul(?:\s+class="bb_ul")?[^>]*>([\s\S]*?)<\/ul>/gi,
      (_, content) => {
        const listItems = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        const markdownItems = listItems
          .map((item: string) => {
            const cleanItem = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, "$1");
            const cleanContent = this._stripHtmlTags(cleanItem).trim();
            return cleanContent ? `- ${cleanContent}` : "";
          })
          .filter(Boolean);
        return markdownItems.length > 0 ? `${markdownItems.join("\n")}\n` : "";
      },
    );

    // Convert ordered lists with Steam's bb_ol class
    markdown = markdown.replace(
      /<ol(?:\s+class="bb_ol")?[^>]*>([\s\S]*?)<\/ol>/gi,
      (_, content) => {
        const listItems = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        const markdownItems = listItems
          .map((item: string, index: number) => {
            const cleanItem = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, "$1");
            const cleanContent = this._stripHtmlTags(cleanItem).trim();
            return cleanContent ? `${index + 1}. ${cleanContent}` : "";
          })
          .filter(Boolean);
        return markdownItems.length > 0 ? `${markdownItems.join("\n")}\n` : "";
      },
    );

    // Convert line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

    // Convert italic text with <em> and <i> tags
    markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, "*$2*");

    // Convert underlined text
    markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, "_$1_");

    // Convert links
    markdown = markdown.replace(
      /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
      "[$2]($1)",
    );

    // Convert divs to line breaks (common in Steam descriptions)
    markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n");

    // Handle span tags with bb_img_ctn class (Steam image containers)
    markdown = markdown.replace(
      /<span\s+class="bb_img_ctn"[^>]*>(.*?)<\/span>/gi,
      "$1",
    );

    return markdown;
  }

  private _cleanupBasicFormatting(markdown: string): string {
    // Clean up spaces before newlines
    markdown = markdown.replace(/ +\n/g, "\n");

    // Clean up excessive spacing around punctuation
    markdown = markdown.replace(/\s+([.,!?;:])/g, "$1");

    return markdown;
  }

  private _processImagePlaceholders(
    markdown: string,
    imageReplacements: { placeholder: string; imageId: string }[],
  ): string {
    const lines = markdown.split("\n");
    const processedLines: string[] = [];

    for (const line of lines) {
      const replacedLines = this._replacePlaceholdersInLine(
        line,
        imageReplacements,
      );
      processedLines.push(...replacedLines);
    }

    return processedLines.join("\n");
  }

  private _replacePlaceholdersInLine(
    line: string,
    imageReplacements: { placeholder: string; imageId: string }[],
  ): string[] {
    const currentLine = line;
    const results: string[] = [];

    // Find all placeholders
    const placeholdersInLine = imageReplacements.filter(({ placeholder }) =>
      currentLine.includes(placeholder),
    );

    if (placeholdersInLine.length === 0) {
      return [line];
    }

    // Sort placeholders by their position
    placeholdersInLine.sort(
      (a, b) =>
        currentLine.indexOf(a.placeholder) - currentLine.indexOf(b.placeholder),
    );

    let lastIndex = 0;

    for (const { placeholder, imageId } of placeholdersInLine) {
      const placeholderIndex = currentLine.indexOf(placeholder, lastIndex);

      if (placeholderIndex === -1) continue;

      // Add text before the placeholder (if any)
      const beforeText = currentLine.substring(lastIndex, placeholderIndex);
      if (beforeText.trim()) {
        results.push(beforeText.trim());
        results.push(""); // Empty line before image
      }

      results.push(`![](/api/v1/object/${imageId})`);

      lastIndex = placeholderIndex + placeholder.length;
    }

    // Add any remaining text after the last placeholder
    const afterText = currentLine.substring(lastIndex);
    if (afterText.trim()) {
      results.push(""); // Empty line after image
      results.push(afterText.trim());
    }

    // If we only have images and no text, return just the images
    if (
      results.every(
        (line) => line === "" || line.startsWith("![](/api/v1/object/"),
      )
    ) {
      return results.filter((line) => line !== "");
    }

    return results;
  }

  private _finalCleanup(markdown: string): string {
    // Clean up multiple consecutive newlines
    markdown = markdown.replace(/\n{3,}/g, "\n\n");

    markdown = markdown.trim();

    return markdown;
  }

  private _stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
