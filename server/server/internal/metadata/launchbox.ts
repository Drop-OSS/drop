import type { Company } from "~/prisma/client/client";
import { AgeRatingOrganization, MetadataSource } from "~/prisma/client/enums";
import { ESRBRating } from "~/utils/ageRatings";
import { MissingMetadataProviderConfig, type MetadataProvider } from ".";
import type {
  _FetchGameMetadataParams,
  _FetchCompanyMetadataParams,
  GameMetadata,
  GameMetadataSearchResult,
  CompanyMetadata,
} from "./types";
import * as jdenticon from "jdenticon";
import { Saxy } from "saxy";
import type { TaskRunContext } from "../tasks";
import { logger } from "~/server/internal/logging";
import { systemConfig } from "../config/sys-conf";
import { createWriteStream } from "fs";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { pipeline } from "stream/promises";
import StreamZip from "node-stream-zip";
import { StringDecoder } from "string_decoder";
import { DropUserAgent } from ".";

const METADATA_URL = "https://gamesdb.launchbox-app.com/Metadata.zip";

const IMAGES_PAGE_URL = "https://gamesdb.launchbox-app.com/games/images";

const REGION_PREFERENCE = [
  "north america",
  "world",
  "europe",
  "japan",
  "australia",
  "asia",
];

interface LaunchBoxGame {
  id: string;
  name: string;
  platform: string;
  releaseYear?: number;
  overview?: string;
  developer?: string;
  publisher?: string;
  genres: string[];
  maxPlayers?: number;
  cooperative?: boolean;
  communityRating?: number;
  communityRatingCount?: number;
  esrb?: string;
  videoUrl?: string;
  wikipediaUrl?: string;
  steamAppId?: string;
}

interface LaunchBoxIndex {
  etag: string | null;
  lastModified: string | null;
  builtAt: string;
  games: Record<string, LaunchBoxGame>;
}

const ESRB_TO_RATING: Record<string, string> = {
  ec: ESRBRating.EC.value,
  e: ESRBRating.E.value,
  e10: ESRBRating.E10.value,
  t: ESRBRating.T.value,
  m: ESRBRating.M.value,
  ao: ESRBRating.AO.value,
};

const GAME_FIELDS = new Set<string>([
  "DatabaseID",
  "Name",
  "Platform",
  "ReleaseYear",
  "ReleaseDate",
  "Overview",
  "Developer",
  "Publisher",
  "Genres",
  "MaxPlayers",
  "Cooperative",
  "CommunityRating",
  "CommunityRatingCount",
  "ESRB",
  "VideoURL",
  "WikipediaURL",
  "SteamAppId",
]);

function toGame(
  get: (field: string) => string | undefined,
): LaunchBoxGame | undefined {
  const id = get("DatabaseID");
  const name = get("Name");
  if (!id || !name) return undefined;

  const year = get("ReleaseYear");
  const release = get("ReleaseDate");
  let releaseYear: number | undefined;
  if (year && /^\d{4}$/.test(year)) {
    releaseYear = parseInt(year, 10);
  } else if (release) {
    const match = /^(\d{4})-/.exec(release);
    if (match) releaseYear = parseInt(match[1], 10);
  }

  const genres = get("Genres");
  const maxPlayersRaw = get("MaxPlayers");
  const maxPlayers = maxPlayersRaw ? parseInt(maxPlayersRaw, 10) : undefined;
  const rating = get("CommunityRating");
  const ratingCount = get("CommunityRatingCount");

  return {
    id,
    name,
    platform: get("Platform") ?? "",
    releaseYear,
    overview: get("Overview"),
    developer: get("Developer"),
    publisher: get("Publisher"),
    genres: genres
      ? genres
          .split(",")
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      : [],
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : undefined,
    cooperative: get("Cooperative") === "true",
    communityRating: rating ? parseFloat(rating) : undefined,
    communityRatingCount: ratingCount ? parseInt(ratingCount, 10) : undefined,
    esrb: get("ESRB"),
    videoUrl: get("VideoURL"),
    wikipediaUrl: get("WikipediaURL"),
    steamAppId: get("SteamAppId"),
  };
}

export async function* parseGameRecords(
  input: AsyncIterable<Buffer> | Iterable<Buffer>,
): AsyncGenerator<LaunchBoxGame> {
  // saxy's typings pull Transform from `readable-stream`, which ships no types.
  const parser = new Saxy() as unknown as Saxy & {
    write(chunk: string): boolean;
    end(): void;
  };
  const ready: LaunchBoxGame[] = [];
  let fields: Map<string, string> | null = null;
  let open: string | null = null;
  let failure: Error | null = null;

  parser.on("tagopen", (tag) => {
    if (tag.name === "Game") {
      fields = new Map();
      open = null;
      return;
    }
    if (fields && GAME_FIELDS.has(tag.name)) {
      open = tag.isSelfClosing ? null : tag.name;
    }
  });

  parser.on("text", ({ contents }) => {
    if (!fields || !open) return;
    const decoded = Saxy.parseEntities(contents);
    fields.set(open, (fields.get(open) ?? "") + decoded);
  });

  parser.on("tagclose", ({ name }) => {
    if (name === "Game") {
      if (fields) {
        const collected = fields;
        const game = toGame((field) => {
          const value = collected.get(field)?.trim();
          return value ? value : undefined;
        });
        if (game) ready.push(game);
      }
      fields = null;
      open = null;
      return;
    }
    if (name === open) open = null;
  });

  parser.on("error", (e) => {
    failure = e instanceof Error ? e : new Error(String(e));
  });

  const decoder = new StringDecoder("utf8");
  for await (const chunk of input) {
    parser.write(decoder.write(chunk));
    if (failure) throw failure;
    while (ready.length > 0) yield ready.shift()!;
  }

  parser.write(decoder.end());
  parser.end();
  if (failure) throw failure;
  while (ready.length > 0) yield ready.shift()!;
}

export interface LaunchBoxMedia {
  kind: string;
  region: string | null;
  url: string;
}

/** Anchors titled "<Game> - <Kind> Image (<Region>)"; the surrounding chrome is ignored. */
export function parseMediaPage(html: string): LaunchBoxMedia[] {
  const pattern =
    /href="(https:\/\/images\.launchbox-app\.com\/[a-f0-9-]+\.(?:jpg|png))"\s*\n?\s*data-gameimageid="\d+"[^>]*?data-title="([^"]+)"/g;
  const media: LaunchBoxMedia[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(pattern)) {
    const [, url, title] = match;
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);

    const parsed = /^.*? - (.+?) Image(?: \((.+)\))?$/.exec(title);
    if (!parsed) continue;
    media.push({
      kind: parsed[1].trim(),
      region: parsed[2]?.trim() ?? null,
      url,
    });
  }
  return media;
}

function byRegionPreference(a: LaunchBoxMedia, b: LaunchBoxMedia): number {
  const rank = (m: LaunchBoxMedia) => {
    const r = m.region?.toLowerCase() ?? "";
    const i = REGION_PREFERENCE.indexOf(r);
    return i === -1 ? REGION_PREFERENCE.length : i;
  };
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return a.kind.localeCompare(b.kind);
}

function pickKind(media: LaunchBoxMedia[], kind: string) {
  return media
    .filter((m) => m.kind.toLowerCase() === kind.toLowerCase())
    .sort(byRegionPreference)[0];
}

function pickPrefixed(media: LaunchBoxMedia[], prefix: string) {
  return media
    .filter((m) => m.kind.toLowerCase().startsWith(prefix.toLowerCase()))
    .sort(byRegionPreference);
}

export class LaunchBoxProvider implements MetadataProvider {
  private index: LaunchBoxIndex | null = null;
  private indexError: string | null = null;
  private readonly indexDir: string;

  constructor() {
    const dir = systemConfig.getLaunchboxIndexDir();
    if (!dir) {
      throw new MissingMetadataProviderConfig(
        "launchboxIndexDir",
        "LaunchBox Games Database",
      );
    }
    this.indexDir = dir;
  }

  name() {
    return "LaunchBox Games Database";
  }

  source(): MetadataSource {
    return MetadataSource.LaunchBox;
  }

  private indexPath(): string {
    return join(this.indexDir, "launchbox-index.json");
  }

  private async loadIndex(): Promise<LaunchBoxIndex | null> {
    if (this.index) return this.index;
    const path = this.indexPath();
    try {
      const raw = await readFile(path, "utf8");
      this.index = JSON.parse(raw) as LaunchBoxIndex;
      return this.index;
    } catch (e) {
      this.indexError = `no usable LaunchBox index at ${path}: ${e}`;
      logger.warn(this.indexError);
      return null;
    }
  }

  async rebuild(context?: TaskRunContext): Promise<LaunchBoxIndex> {
    const path = this.indexPath();
    const previous = await this.loadIndex();
    const head = await $fetch.raw(METADATA_URL, {
      method: "HEAD",
      headers: { "User-Agent": DropUserAgent },
    });
    const etag = head.headers.get("etag");
    const lastModified = head.headers.get("last-modified");

    if (previous && etag && previous.etag === etag) {
      logger.info("LaunchBox index is current (ETag unchanged)");
      context?.progress(100);
      return previous;
    }

    await mkdir(dirname(path), { recursive: true });
    const zipPath = `${path}.zip.part`;
    const response = await $fetch.raw(METADATA_URL, {
      responseType: "stream",
      headers: { "User-Agent": DropUserAgent },
    });
    await pipeline(
      response.body as unknown as AsyncIterable<Uint8Array>,
      createWriteStream(zipPath),
    );
    context?.progress(30);

    const games: Record<string, LaunchBoxGame> = {};
    let count = 0;
    const zip = new StreamZip.async({ file: zipPath });
    try {
      const metadata = await zip.entry("Metadata.xml");
      if (!metadata) throw new Error("Metadata.xml missing from archive");
      const stream = await zip.stream(metadata);
      for await (const game of parseGameRecords(
        stream as unknown as AsyncIterable<Buffer>,
      )) {
        games[game.id] = game;
        count++;
      }
    } finally {
      await zip.close();
    }
    context?.progress(80);

    const index: LaunchBoxIndex = {
      etag: etag ?? null,
      lastModified: lastModified ?? null,
      builtAt: new Date().toISOString(),
      games,
    };

    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(index));
    await rename(tmp, path);
    await rm(zipPath, { force: true });

    this.index = index;
    this.indexError = null;
    logger.info(`Built LaunchBox index: ${count} games`);
    return index;
  }

  async search(query: string): Promise<GameMetadataSearchResult[]> {
    const index = await this.loadIndex();
    if (!index) {
      if (this.indexError) logger.warn(this.indexError);
      return [];
    }

    const needle = query.toLowerCase();
    const matches: LaunchBoxGame[] = [];
    for (const game of Object.values(index.games)) {
      if (!game.name.toLowerCase().includes(needle)) continue;
      matches.push(game);
      if (matches.length >= 50) break;
    }

    matches.sort((a, b) => {
      const aPrefix = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bPrefix = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.name.length - b.name.length;
    });

    return matches.map((game) => ({
      id: game.id,
      name: game.name,
      icon: "",
      description: game.overview?.slice(0, 500) ?? "",
      year: game.releaseYear ?? 0,
    }));
  }

  private async fetchMedia(
    gameId: string | number | null | undefined,
  ): Promise<LaunchBoxMedia[]> {
    if (gameId === null || gameId === undefined) return [];
    try {
      const html = await $fetch<string>(`${IMAGES_PAGE_URL}/${gameId}`, {
        headers: { "User-Agent": DropUserAgent },
      });
      return parseMediaPage(html);
    } catch (e) {
      logger.warn(`LaunchBox media page failed for ${gameId}: ${e}`);
      return [];
    }
  }

  async fetchGame(
    { id, company, createObject }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    const index = await this.loadIndex();
    const game = index?.games[id];

    const companies = async (value?: string) => {
      const names = (value ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      const found = await Promise.all(names.map((n) => company(n)));
      return found.filter(
        (c: Company | undefined): c is Company => c !== undefined,
      );
    };

    if (!game) {
      context?.logger.error(`No LaunchBox game with id ${id}`);
      throw new Error(`No LaunchBox game with id ${id}`);
    }

    context?.logger.info(`Found LaunchBox game: "${game.name}"`);
    context?.progress(40);

    const media = await this.fetchMedia(id);
    context?.logger.info(
      `LaunchBox media: ${media.length} entries for ${game.name}`,
    );

    const cover = pickKind(media, "Box - Front");
    const banner =
      pickKind(media, "Banner") ?? pickKind(media, "Fanart - Background");
    const logo = pickKind(media, "Clear Logo");

    const screenshots = pickPrefixed(media, "Screenshot");
    const others = media.filter(
      (m) =>
        m.kind.toLowerCase() !== "box - front" &&
        m.kind.toLowerCase() !== "banner" &&
        m.kind.toLowerCase() !== "clear logo" &&
        !m.kind.toLowerCase().startsWith("screenshot"),
    );

    const placeholder = () => createObject(jdenticon.toPng(id, 512));
    const objectFor = (url?: string) =>
      url ? createObject(url) : placeholder();

    const coverId = objectFor(cover?.url);
    const bannerId = objectFor(banner?.url ?? cover?.url);
    const icon = objectFor(logo?.url ?? cover?.url);
    const images = [
      ...screenshots.map((m) => createObject(m.url)),
      ...others.map((m) => createObject(m.url)),
    ];

    const released = game?.releaseYear
      ? new Date(Date.UTC(game.releaseYear, 0, 1))
      : new Date();

    const ageRatings = [];
    if (game?.esrb) {
      // "E10+ - Everyone 10+" and "E10 - Everyone 10+" both reduce to e10.
      const key = game.esrb
        .split(" ")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const rating = ESRB_TO_RATING[key];
      if (rating) {
        ageRatings.push({
          organization: AgeRatingOrganization.ESRB,
          rating,
        });
      }
    }

    context?.progress(100);

    const name = game.name;
    const overview = game?.overview ?? "";

    return {
      id,
      name,
      shortDescription: overview.slice(0, 200),
      description: overview,
      released,
      publishers: await companies(game.publisher),
      developers: await companies(game.developer),
      tags: [
        ...(game?.genres ?? []),
        ...(game?.videoUrl ? [`video: ${game.videoUrl}`] : []),
      ],
      reviews:
        game?.communityRating !== undefined
          ? [
              {
                metadataId: game.id,
                metadataSource: MetadataSource.LaunchBox,
                mReviewCount: game.communityRatingCount ?? 0,
                mReviewHref: `https://gamesdb.launchbox-app.com/games/details/${game.id}`,
                mReviewRating: game.communityRating / 5,
              },
            ]
          : [],
      ageRatings,
      icon,
      bannerId,
      coverId,
      images,
    } satisfies GameMetadata;
  }

  async fetchCompany({
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata | undefined> {
    void createObject;
    return undefined;
  }
}
