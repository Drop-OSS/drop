import { AgeRatingOrganization, MetadataSource } from "~/prisma/client/enums";
import type { MetadataProvider } from ".";
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
import { mkdir, open, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { pipeline } from "stream/promises";
import { createInflateRaw } from "zlib";
import { DropUserAgent } from ".";

const METADATA_URL = "https://gamesdb.launchbox-app.com/Metadata.zip";

const SEARCH_API_URL = "https://gamesdb-api.launchbox-app.com/api/search";

const IMAGE_URL = "https://images.launchbox-app.com";

const IMAGES_PAGE_URL = "https://gamesdb.launchbox-app.com/games/images";

const REGION_PREFERENCE = [
  "north america",
  "world",
  "europe",
  "japan",
  "australia",
  "asia",
];

const API_ID_PREFIX = "api:";

interface LaunchBoxSearchHit {
  gameKey: number;
  name: string;
  platformName: string;
  thumbName: string | null;
}

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

const ESRB_TO_ORGANIZATION: Record<string, string> = {
  e: "E",
  e10: "E10+",
  t: "T",
  m: "M",
  ao: "AO",
  rp: "RP",
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

  for await (const chunk of input) {
    parser.write(chunk.toString("utf8"));
    if (failure) throw failure;
    while (ready.length > 0) yield ready.shift()!;
  }

  parser.end();
  if (failure) throw failure;
  while (ready.length > 0) yield ready.shift()!;
}

export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

export function readZipCentralDirectory(buffer: Buffer): ZipEntry[] {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;
  let eocd = -1;
  for (
    let i = buffer.length - 22;
    i >= 0 && i > buffer.length - 22 - 65536;
    i--
  ) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("not a zip archive: no end-of-directory");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CD_SIG)
      throw new Error("corrupt zip central directory");
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      localHeaderOffset,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Deflate is one stream per entry, so a single inflate is fed block by block. */
export async function* zipEntryStream(
  zipPath: string,
  entry: ZipEntry,
): AsyncGenerator<Buffer> {
  const handle = await open(zipPath, "r");
  const queue: Buffer[] = [];
  let ended = false;
  let failure: Error | null = null;
  let wake: (() => void) | null = null;
  const notify = () => {
    if (wake) {
      wake();
      wake = null;
    }
  };

  let inflate: ReturnType<typeof createInflateRaw> | null = null;
  if (entry.compressionMethod === 8) {
    inflate = createInflateRaw();
    inflate.on("data", (c: Buffer) => {
      queue.push(c);
      notify();
    });
    inflate.on("end", () => {
      ended = true;
      notify();
    });
    inflate.on("error", (e: Error) => {
      failure = e;
      ended = true;
      notify();
    });
  } else if (entry.compressionMethod !== 0) {
    await handle.close();
    throw new Error(
      `unsupported zip compression method ${entry.compressionMethod}`,
    );
  }

  try {
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, entry.localHeaderOffset);

    // Bit 3: sizes live in a trailing descriptor, so the local ones are only trustworthy when clear.
    const generalPurposeBitFlag = header.readUInt16LE(6);
    const hasDataDescriptor = (generalPurposeBitFlag & 0x08) !== 0;
    if (!hasDataDescriptor) {
      const localCompressed = header.readUInt32LE(18);
      const localUncompressed = header.readUInt32LE(22);
      if (
        localCompressed !== entry.compressedSize ||
        localUncompressed !== entry.uncompressedSize
      ) {
        throw new Error(
          `zip entry "${entry.name}": local header sizes disagree with the central directory`,
        );
      }
    }

    const dataStart =
      entry.localHeaderOffset +
      30 +
      header.readUInt16LE(26) +
      header.readUInt16LE(28);

    const BLOCK = 1024 * 1024;
    let read = 0;
    let produced = 0;
    let inputDone = false;

    /** The loop stops at compressedSize, so a zip that inflates larger than declared is not read. */
    const checked = (chunk: Buffer): Buffer => {
      produced += chunk.length;
      if (produced > entry.uncompressedSize) {
        throw new Error(
          `zip entry "${entry.name}": inflated past its declared uncompressed size of ${entry.uncompressedSize} bytes`,
        );
      }
      return chunk;
    };

    while (!ended || queue.length > 0) {
      while (queue.length > 0) {
        yield checked(queue.shift() as Buffer);
      }
      if (failure) throw failure;
      if (ended) break;

      if (!inputDone) {
        if (read >= entry.compressedSize) {
          inputDone = true;
          inflate?.end();
          continue;
        }
        const want = Math.min(BLOCK, entry.compressedSize - read);
        const block = Buffer.alloc(want);
        const { bytesRead } = await handle.read(
          block,
          0,
          want,
          dataStart + read,
        );
        if (bytesRead === 0) {
          inputDone = true;
          inflate?.end();
          continue;
        }
        read += bytesRead;
        if (inflate) inflate.write(block.subarray(0, bytesRead));
        else queue.push(block.subarray(0, bytesRead));
        continue;
      }

      if (!ended && queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    }
    if (failure) throw failure;
    if (produced !== entry.uncompressedSize) {
      throw new Error(
        `zip entry "${entry.name}": inflated ${produced} bytes but the central directory declares ${entry.uncompressedSize}`,
      );
    }
  } finally {
    inflate?.destroy();
    await handle.close();
  }
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

  name() {
    return "LaunchBox Games Database";
  }

  source(): MetadataSource {
    return MetadataSource.LaunchBox;
  }

  private indexPath(): string | null {
    const dir = systemConfig.getLaunchboxIndexDir();
    if (!dir) return null;
    return join(dir, "launchbox-index.json");
  }

  private enabled(): boolean {
    return this.indexPath() !== null;
  }

  private async loadIndex(): Promise<LaunchBoxIndex | null> {
    if (this.index) return this.index;
    const path = this.indexPath();
    if (!path) return null;
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

  async rebuild(): Promise<LaunchBoxIndex | null> {
    const path = this.indexPath();
    if (!path) {
      logger.info(
        "LaunchBox index disabled (no launchboxIndexDir configured); skipping rebuild",
      );
      return null;
    }

    const previous = await this.loadIndex();
    try {
      const head = await $fetch.raw(METADATA_URL, {
        method: "HEAD",
        headers: { "User-Agent": DropUserAgent },
      });
      const etag = head.headers.get("etag");
      const lastModified = head.headers.get("last-modified");

      if (previous && etag && previous.etag === etag) {
        logger.info("LaunchBox index is current (ETag unchanged)");
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

      const zipBuffer = await readFile(zipPath);
      const entries = readZipCentralDirectory(zipBuffer);
      const metadata = entries.find((e) => e.name === "Metadata.xml");
      if (!metadata) throw new Error("Metadata.xml missing from archive");

      const games: Record<string, LaunchBoxGame> = {};
      let count = 0;
      for await (const game of parseGameRecords(
        zipEntryStream(zipPath, metadata),
      )) {
        games[game.id] = game;
        count++;
      }

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
    } catch (e) {
      this.indexError = `LaunchBox index rebuild failed: ${e}`;
      logger.warn(
        `${this.indexError} — continuing to serve the previous index if present`,
      );
      return previous;
    }
  }

  private async searchApi(query: string): Promise<LaunchBoxSearchHit[]> {
    try {
      const response = await $fetch<{
        count: number;
        data: LaunchBoxSearchHit[];
      }>(`${SEARCH_API_URL}/${encodeURIComponent(query)}`, {
        headers: { "User-Agent": DropUserAgent },
      });
      return response?.data ?? [];
    } catch (e) {
      logger.warn(
        `LaunchBox search API failed for ${JSON.stringify(query)}: ${e}`,
      );
      return [];
    }
  }

  async search(query: string): Promise<GameMetadataSearchResult[]> {
    const apiHits = await this.searchApi(query);
    if (apiHits.length > 0) {
      return apiHits.map((hit) => ({
        id: `${API_ID_PREFIX}${hit.gameKey}`,
        name: hit.name,
        icon: hit.thumbName ? `${IMAGE_URL}/${hit.thumbName}` : "",
        description: hit.platformName,
        year: 0,
      }));
    }

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

  /** No by-id endpoint exists; callers fall back to the archive by (name, platform). */
  private async searchApiById(
    _gameKey: string,
  ): Promise<LaunchBoxSearchHit | null> {
    void _gameKey;
    return null;
  }

  /** The API and archive ids are unrelated namespaces, so this joins on (name, platform). */
  private async archiveIdFor(hit: LaunchBoxSearchHit): Promise<string | null> {
    const index = await this.loadIndex();
    if (!index) return null;
    const candidates = Object.values(index.games).filter(
      (g) =>
        g.name === hit.name &&
        g.platform.toLowerCase() === hit.platformName.toLowerCase(),
    );
    return candidates.length === 1 ? candidates[0].id : null;
  }

  async fetchGame(
    { id, createObject }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    const apiHit = id.startsWith(API_ID_PREFIX)
      ? await this.searchApiById(id.slice(API_ID_PREFIX.length))
      : null;
    const archiveId = apiHit ? await this.archiveIdFor(apiHit) : id;

    const index = await this.loadIndex();
    const game = index && archiveId ? index.games[archiveId] : undefined;

    if (!game && !apiHit) {
      context?.logger.error(`No LaunchBox game with id ${id}`);
      throw new Error(`No LaunchBox game with id ${id}`);
    }

    context?.logger.info(
      `Found LaunchBox game: "${game?.name ?? apiHit?.name}"`,
    );
    context?.progress(40);

    const media = await this.fetchMedia(archiveId ?? apiHit?.gameKey);
    context?.logger.info(
      `LaunchBox media: ${media.length} entries for ${game?.name ?? apiHit?.name}`,
    );

    const cover =
      pickKind(media, "Box - Front") ??
      (apiHit?.thumbName
        ? { url: `${IMAGE_URL}/${apiHit.thumbName}` }
        : undefined);
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

    const placeholder = () =>
      createObject(jdenticon.toPng(archiveId ?? id, 512));
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
      const bare = ESRB_TO_ORGANIZATION[game.esrb.split(" ")[0].toLowerCase()];
      if (bare) {
        ageRatings.push({
          organization: AgeRatingOrganization.ESRB,
          rating: bare,
        });
      }
    }

    context?.progress(100);

    const name = game?.name ?? apiHit?.name ?? id;
    const overview = game?.overview ?? "";

    return {
      id,
      name,
      shortDescription: overview.slice(0, 200),
      description: overview,
      released,
      publishers: [],
      developers: [],
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
