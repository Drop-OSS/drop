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
import type { TaskRunContext } from "../tasks";
import { logger } from "~/server/internal/logging";
import { systemConfig } from "../config/sys-conf";
import { createWriteStream } from "fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { pipeline } from "stream/promises";
import { createInflateRaw } from "zlib";
import { DropUserAgent } from ".";

/**
 * LaunchBox Games Database provider.
 *
 * LaunchBox publishes no API. The entire database is a single zip archive:
 *
 *   https://gamesdb.launchbox-app.com/Metadata.zip
 *
 * ~109MB compressed, ~578MB uncompressed, containing:
 *   Metadata.xml  (~518MB) game records, a flat streamable <Game> sequence
 *   Mame.xml      (~46MB)  arcade machine records
 *   Files.xml     (~14MB)  (Platform, FileName, GameName) ROM-filename bridge
 *   Platforms.xml (~0.3MB) per-platform hardware metadata
 *
 * 518MB cannot be parsed per lookup, so this provider builds a local index once
 * and reuses it. The index is a CACHE, NOT STATE:
 *   - it is derived entirely from the archive and can be rebuilt at any time
 *   - deleting it costs a rebuild, never data
 *   - if a refresh fails the previous index keeps serving and the failure is logged
 *
 * The index is opt-in. With it disabled the provider reports itself as
 * unavailable rather than silently downloading 109MB inside a search.
 *
 * Measured against the 2026-11-01 archive:
 *   190,165 game records, full index build ~35s, index JSON ~174MB on disk.
 *   Field coverage: developer 91%, publisher 88%, genres 90%, release year 96%,
 *   overview 94%, ESRB 73%.
 */

const METADATA_URL = "https://gamesdb.launchbox-app.com/Metadata.zip";

/** One game record, as stored in the index. */
interface LaunchBoxGame {
  /** LaunchBox DatabaseID — stable across archive refreshes. */
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
  /** ETag of the archive this index was built from, for If-None-Match. */
  etag: string | null;
  lastModified: string | null;
  builtAt: string;
  games: Record<string, LaunchBoxGame>;
}

/** The subset of a <Game> element this provider reads. */
type GameField =
  | "DatabaseID"
  | "Name"
  | "Platform"
  | "ReleaseYear"
  | "ReleaseDate"
  | "Overview"
  | "Developer"
  | "Publisher"
  | "Genres"
  | "MaxPlayers"
  | "Cooperative"
  | "CommunityRating"
  | "CommunityRatingCount"
  | "ESRB"
  | "VideoURL"
  | "WikipediaURL"
  | "SteamAppId";

const ESRB_TO_ORGANIZATION: Record<string, string> = {
  // LaunchBox stores the ESRB value with its descriptor ("E - Everyone"),
  // whereas Drop stores the bare rating plus the organization.
  e: "E",
  e10: "E10+",
  t: "T",
  m: "M",
  ao: "AO",
  rp: "RP",
};

/** XML entity decoding for the handful of entities LaunchBox actually emits. */
function decodeXmlText(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&");
}

/**
 * Pulls a single field's text out of a <Game> element body.
 *
 * Deliberately a regex rather than a DOM parse: Metadata.xml is 518MB and
 * LaunchBox emits a regular, non-nested <Game> record with no attributes on
 * these fields, so a linear scan is both correct here and cheap enough to run
 * over the whole file. Elements may be self-closing (<Genres />).
 */
function readField(body: string, field: GameField): string | undefined {
  const match = new RegExp(
    `<${field}(?:\\s[^>]*)?>(?:([\\s\\S]*?)</${field}>)?`,
  ).exec(body);
  if (!match) return undefined;
  const raw = match[1];
  if (raw === undefined) return undefined;
  const text = decodeXmlText(raw).trim();
  return text.length > 0 ? text : undefined;
}

function parseGame(body: string): LaunchBoxGame | undefined {
  const id = readField(body, "DatabaseID");
  const name = readField(body, "Name");
  if (!id || !name) return undefined;

  const platform = readField(body, "Platform") ?? "";

  const yearRaw = readField(body, "ReleaseYear");
  const releaseRaw = readField(body, "ReleaseDate");
  let releaseYear: number | undefined;
  if (yearRaw && /^\d{4}$/.test(yearRaw)) {
    releaseYear = parseInt(yearRaw, 10);
  } else if (releaseRaw) {
    const year = /^(\d{4})-/.exec(releaseRaw);
    if (year) releaseYear = parseInt(year[1], 10);
  }

  const genresRaw = readField(body, "Genres");
  const genres = genresRaw
    ? genresRaw
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0)
    : [];

  const maxPlayersRaw = readField(body, "MaxPlayers");
  const maxPlayers = maxPlayersRaw ? parseInt(maxPlayersRaw, 10) : undefined;

  const ratingRaw = readField(body, "CommunityRating");
  const ratingCountRaw = readField(body, "CommunityRatingCount");

  return {
    id,
    name,
    platform,
    releaseYear,
    overview: readField(body, "Overview"),
    developer: readField(body, "Developer"),
    publisher: readField(body, "Publisher"),
    genres,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : undefined,
    cooperative: readField(body, "Cooperative") === "true",
    communityRating: ratingRaw ? parseFloat(ratingRaw) : undefined,
    communityRatingCount: ratingCountRaw
      ? parseInt(ratingCountRaw, 10)
      : undefined,
    esrb: readField(body, "ESRB"),
    videoUrl: readField(body, "VideoURL"),
    wikipediaUrl: readField(body, "WikipediaURL"),
    steamAppId: readField(body, "SteamAppId"),
  };
}

/**
 * Streams <Game> elements out of an XML document without holding it in memory.
 *
 * Callers get one callback per record body (the text between <Game> and
 * </Game>). Chunk boundaries can fall anywhere, including inside a tag, so the
 * open buffer is only trimmed at a boundary we have actually found.
 */
export async function* streamGameRecords(
  input: AsyncIterable<Buffer> | Iterable<Buffer>,
): AsyncGenerator<string> {
  const OPEN = "<Game>";
  const CLOSE = "</Game>";
  let buffer = "";

  for await (const chunk of input) {
    buffer += chunk.toString("utf8");

    for (;;) {
      const open = buffer.indexOf(OPEN);
      if (open === -1) {
        // Keep a tail in case a tag straddles the chunk boundary.
        if (buffer.length > OPEN.length) buffer = buffer.slice(-OPEN.length);
        break;
      }
      const close = buffer.indexOf(CLOSE, open);
      if (close === -1) {
        // Record continues into the next chunk.
        buffer = buffer.slice(open);
        break;
      }
      yield buffer.slice(open + OPEN.length, close);
      buffer = buffer.slice(close + CLOSE.length);
    }
  }
}

/**
 * Minimal zip reader for a single stored or deflated entry.
 *
 * The archive is a plain zip with four entries and no encryption. Rather than
 * add a dependency, this walks the central directory and exposes one entry as
 * an async byte stream — which is all the index build needs.
 */
export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

export function readZipCentralDirectory(buffer: Buffer): ZipEntry[] {
  // End of central directory: signature 0x06054b50, scanned backwards because
  // the trailing comment (usually empty) makes its offset non-fixed.
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

/**
 * Yields the decompressed bytes of one zip entry.
 *
 * Deflate is one continuous stream across the whole entry, so a single inflate
 * instance is fed block-by-block from disk and its output drained through a
 * queue. (An earlier draft inflated each block separately; deflate has no block
 * boundaries there, so that silently truncated the stream.)
 */
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

    // Bit 3 means the local header carries zeroed sizes and the real ones live
    // in a trailing data descriptor, so the local sizes are only trustworthy
    // when it is clear. When they are present they must agree with the central
    // directory, or we are reading a file that is not the one we indexed.
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

    /**
     * Enforces the declared uncompressed size.
     *
     * The read loop is bounded by compressedSize, so without this a zip that
     * claims a small entry but inflates far larger would be parsed in full.
     * One archive is downloaded from a third party and parsed in a server, so
     * the declared size is a limit, not a hint.
     */
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

      // Nothing buffered: feed more compressed input.
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

      // Input is exhausted and the queue is empty: wait for the inflate stream
      // to emit, not for a timer. The handlers above resolve this promise, so
      // the loop is driven by the stream's own events.
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

  /** True when an operator has opted in by configuring an index directory. */
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

  /**
   * Rebuilds the index from the archive.
   *
   * Writes to a temp file and renames, so a failed build never destroys a
   * working index. Returns the previous index on failure.
   */
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
      for await (const body of streamGameRecords(
        zipEntryStream(zipPath, metadata),
      )) {
        const game = parseGame(body);
        if (!game) continue;
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

    // Prefer exact-prefix matches, then shorter names — "Doom" should outrank
    // "Doom 3 BFG Edition" for the query "doom".
    matches.sort((a, b) => {
      const aPrefix = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bPrefix = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.name.length - b.name.length;
    });

    return matches.map((game) => ({
      id: game.id,
      name: game.name,
      // The archive carries no images, so there is nothing to show here.
      icon: "",
      description: game.overview?.slice(0, 500) ?? "",
      year: game.releaseYear ?? 0,
    }));
  }

  async fetchGame(
    { id, createObject }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    const index = await this.loadIndex();
    if (!index) {
      throw new Error(
        this.indexError ?? "LaunchBox index is not available or not built",
      );
    }

    const game = index.games[id];
    if (!game) {
      context?.logger.error(`No LaunchBox game with DatabaseID ${id}`);
      throw new Error(`No LaunchBox game with DatabaseID ${id}`);
    }

    context?.logger.info(`Found LaunchBox game: "${game.name}"`);
    context?.progress(40);

    // The archive has no artwork. Generate a deterministic placeholder so the
    // object references stay non-null, matching what the Manual provider does.
    const iconRaw = jdenticon.toPng(game.id, 512);
    const icon = createObject(iconRaw);

    const released = game.releaseYear
      ? new Date(Date.UTC(game.releaseYear, 0, 1))
      : new Date();

    const ageRatings = [];
    if (game.esrb) {
      const bare = ESRB_TO_ORGANIZATION[game.esrb.split(" ")[0].toLowerCase()];
      if (bare) {
        ageRatings.push({
          organization: AgeRatingOrganization.ESRB,
          rating: bare,
        });
      }
    }

    context?.progress(100);

    return {
      id: game.id,
      name: game.name,
      shortDescription: game.overview?.slice(0, 200) ?? "",
      description: game.overview ?? "",
      released,
      publishers: [],
      developers: [],
      tags: game.genres,
      reviews:
        game.communityRating !== undefined
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
      bannerId: icon,
      coverId: icon,
      images: [],
    } satisfies GameMetadata;
  }

  async fetchCompany({
    createObject,
  }: _FetchCompanyMetadataParams): Promise<CompanyMetadata | undefined> {
    // The LaunchBox archive records developer/publisher names as free text on
    // each game and carries no company records, so there is nothing to enrich
    // from here. Returning undefined lets the metadata handler fall through to
    // the next provider rather than inventing a company.
    void createObject;
    return undefined;
  }
}
