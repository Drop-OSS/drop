import { createError } from "h3";
import { createHash } from "node:crypto";
import * as zlib from "node:zlib";
import { gunzipSync, inflateSync, inflateRawSync } from "node:zlib";
import { fromBinary } from "@bufbuild/protobuf";
import {
  ManifestSchema,
  Chunk_ChunkType,
  type Manifest,
} from "../../internal/proto/ubisoft-demux/proto/download_pb";

/**
 * Ubisoft install-manifest handling: the ground truth for which files a game
 * build contains and which content-addressed slices hold their bytes.
 *
 * Wire format (live-verified Nov 2026, Anno 2070 pid 22): the CDN blob at
 * `manifests/<sha>.manifest` is a 356-byte header (version bytes + a 344-char
 * base64 signature) followed by a protobuf `mg.protocol.download.Manifest`.
 * Modern titles gzip that payload; older ones use raw zlib deflate. Slice
 * bodies on the CDN are individually compressed (zstd for current titles,
 * zlib for some legacy ones, raw for others) - detected per slice by magic.
 */

const MANIFEST_HEADER_BYTES = 356;

/** Node's zstd support is newer than the shared type floor; probe it. */
const zstdDecompressSync = (
  zlib as unknown as Record<string, ((b: Buffer) => Buffer) | undefined>
).zstdDecompressSync;

function zstdDecompress(body: Buffer): Buffer {
  if (!zstdDecompressSync)
    throw new Error("this runtime cannot decompress zstd");
  return zstdDecompressSync(body);
}

/** Decode the manifest payload, trying every framing seen live. */
export function parseUbisoftManifest(blob: Buffer): Manifest {
  if (blob.length <= MANIFEST_HEADER_BYTES) {
    throw createError({
      statusCode: 502,
      statusMessage: "Ubisoft install manifest is truncated",
    });
  }
  const body = blob.subarray(MANIFEST_HEADER_BYTES);
  const framings: (() => Buffer)[] = [];
  if (body[0] === 0x28 && body[1] === 0xb5)
    framings.push(() => zstdDecompress(body));
  if (body[0] === 0x1f && body[1] === 0x8b)
    framings.push(() => gunzipSync(body));
  if (body[0] === 0x78) framings.push(() => inflateSync(body));
  // Fall back through the rest blind: raw deflate, zstd, then bare protobuf
  // (protobuf decoding is permissive, so results are validated after).
  framings.push(
    () => inflateRawSync(body),
    () => zstdDecompress(body),
    () => body,
  );
  for (const unwrap of framings) {
    let payload: Buffer;
    try {
      payload = unwrap();
    } catch {
      continue;
    }
    try {
      const manifest = fromBinary(ManifestSchema, payload);
      if (manifest.chunks.some((chunk) => chunk.files.length > 0))
        return manifest;
    } catch {
      continue;
    }
  }
  throw createError({
    statusCode: 502,
    statusMessage: "Ubisoft install manifest did not decode as a game manifest",
  });
}

export const sha1Hex = (bytes: Buffer): string =>
  createHash("sha1").update(bytes).digest("hex").toUpperCase();

/** Upper-case hex SHA-1 as the plan stores it. */
const HEX40 = /^[0-9A-F]{40}$/;

/**
 * The single-character CDN directory between `slices_v3/` and the slice hash.
 * Ported byte-for-byte from the launcher-side reference (ubisoft-demux util):
 * the first two hex digits, byte-swapped, decide a base32 alphabet position;
 * odd bytes land in the alphabet's second half.
 *
 * The hex decode is unforgiving: a non-hex prefix (an empty hash, or a whole
 * CDN path passed by mistake) decodes to a zero-length buffer and `readUInt8`
 * throws a raw `ERR_BUFFER_OUT_OF_BOUNDS`. Refuse with a descriptive 502
 * before that can happen.
 */
export function fileHashToPathChar(hashHexUpper: string): string {
  if (!/^[0-9a-fA-F]{2}/.test(hashHexUpper ?? "")) {
    throw createError({
      statusCode: 502,
      statusMessage: `Ubisoft slice hash "${String(hashHexUpper).slice(0, 48)}" is not a hex SHA-1 - cannot derive a CDN path`,
    });
  }
  const base32 = "0123456789abcdefghijklmnopqrstuv";
  const reversed = Buffer.from(
    `${hashHexUpper[1]}${hashHexUpper[0]}`,
    "hex",
  ).readUInt8();
  return base32[Math.floor(reversed / 16) + (reversed % 2 === 0 ? 0 : 16)];
}

/** CDN-relative slice path; the request Ubisoft's UrlReq service expects. */
export function sliceCdnPath(sliceSha1HexUpper: string): string {
  return `slices_v3/${fileHashToPathChar(sliceSha1HexUpper)}/${sliceSha1HexUpper.toUpperCase()}`;
}

/**
 * Every candidate CDN path for a slice, computed directory first. The
 * launcher-side reference clients keep the same 32-prefix fallback because
 * the derivation is not documented: if the computed path 404s the streamer
 * mints URLs for the rest instead of failing the whole ingest.
 */
export function sliceCdnPathCandidates(sliceSha1HexUpper: string): string[] {
  const hash = sliceSha1HexUpper.toUpperCase();
  const computed = sliceCdnPath(hash);
  const paths = "0123456789abcdefghijklmnopqrstuv"
    .split("")
    .map((char) => `slices_v3/${char}/${hash}`)
    .filter((path) => path !== computed);
  return [computed, ...paths];
}

export type UbisoftPlanSlice = {
  /** CDN-relative path for the UrlReq mint. */
  cdnPath: string;
  /** SHA-1 the decompressed slice body must hash to (content hash). */
  verifySha1: string;
  /** Byte offset of this slice's content inside the assembled file. */
  offset: number;
  /** Expected decompressed length. */
  size: number;
};

export type UbisoftPlanFile = {
  path: string;
  size: number;
  slices: UbisoftPlanSlice[];
};

/**
 * Flatten a manifest into a download plan: required chunks plus any chunk
 * tagged with the wanted language. Manifest paths are untrusted: backslashes
 * normalise, and absolute or traversal paths are refused outright.
 *
 * Live-verified quirk: `sliceList[].fileOffset` often arrives as protobuf
 * default zeros; when every offset is zero the slices are treated as
 * implicitly sequential (offset = sum of preceding slice sizes).
 */
export function buildUbisoftDownloadPlan(
  manifest: Manifest,
  language = "en-US",
): { files: UbisoftPlanFile[]; totalBytes: number; totalSlices: number } {
  const wanted = language.toLowerCase();
  const files: UbisoftPlanFile[] = [];
  for (const chunk of manifest.chunks) {
    const required = chunk.type === Chunk_ChunkType.ChunkType_Required;
    const tagged =
      chunk.language !== "" && chunk.language.toLowerCase() === wanted;
    if (!required && !tagged) continue;
    for (const file of chunk.files) {
      if (file.isDir) continue;
      const path = file.name.replaceAll("\\", "/");
      if (
        path.startsWith("/") ||
        path.split("/").some((part) => part === ".." || part === "")
      ) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft manifest declares an unsafe file path: ${file.name}`,
        });
      }
      const size = Number(file.size);
      const contentHashes = file.slices.map((slice) =>
        Buffer.from(slice).toString("hex").toUpperCase(),
      );
      const descriptors = file.sliceList;
      if (descriptors.length === 0 && contentHashes.length === 0) {
        // Live manifests carry empty placeholder files (dump.txt,
        // placeholder.txt) with no slices at all: they land as empty files.
        if (size === 0) {
          files.push({ path, size: 0, slices: [] });
          continue;
        }
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft manifest file ${path} declares ${size} bytes but carries no slices`,
        });
      }
      if (descriptors.length === 0) {
        if (contentHashes.length === 1) {
          if (!HEX40.test(contentHashes[0])) {
            throw createError({
              statusCode: 502,
              statusMessage: `Ubisoft manifest file ${path} carries a slice with no content hash - unsupported manifest generation`,
            });
          }
          files.push({
            path,
            size,
            slices: [
              {
                cdnPath: sliceCdnPath(contentHashes[0]),
                verifySha1: contentHashes[0],
                offset: 0,
                size,
              },
            ],
          });
          continue;
        }
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft manifest file ${path} has ${contentHashes.length} slice hashes but no slice descriptors`,
        });
      }
      if (descriptors.length !== contentHashes.length) {
        throw createError({
          statusCode: 502,
          statusMessage: `Ubisoft manifest file ${path} declares ${descriptors.length} slice descriptors for ${contentHashes.length} content hashes`,
        });
      }
      const anyOffset = descriptors.some((d) => d.fileOffset !== 0n);
      let cursor = 0;
      const slices: UbisoftPlanSlice[] = [];
      for (let i = 0; i < descriptors.length; i++) {
        const descriptor = descriptors[i];
        const offset = anyOffset ? Number(descriptor.fileOffset) : cursor;
        const sliceSize = descriptor.size;
        // protobuf-es gives absent proto2 `bytes` as an empty (but truthy)
        // Uint8Array - fall back to the content hash by byte length.
        const downloadSha1 =
          descriptor.downloadSha1.byteLength > 0
            ? Buffer.from(descriptor.downloadSha1).toString("hex").toUpperCase()
            : contentHashes[i];
        // Plan-time gate: a slice missing either hash cannot be fetched or
        // verified, and deriving a CDN path from a non-hash crashes the
        // worker pool with a raw RangeError. Name the file and slice here.
        if (!HEX40.test(downloadSha1)) {
          throw createError({
            statusCode: 502,
            statusMessage: `Ubisoft manifest file ${path} slice ${i} has no download or content hash - unsupported manifest generation`,
          });
        }
        if (!HEX40.test(contentHashes[i])) {
          throw createError({
            statusCode: 502,
            statusMessage: `Ubisoft manifest file ${path} slice ${i} declares no content hash to verify against - unsupported manifest generation`,
          });
        }
        slices.push({
          cdnPath: sliceCdnPath(downloadSha1),
          verifySha1: contentHashes[i],
          offset,
          size: sliceSize,
        });
        cursor = offset + sliceSize;
      }
      files.push({ path, size, slices });
    }
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const totalSlices = files.reduce((sum, file) => sum + file.slices.length, 0);
  return { files, totalBytes, totalSlices };
}

/**
 * Launch documents from the ownership service's per-game install
 * configuration (YAML): `root.name` is the title and the
 * `start_game.online.executables[]` entries (falling back to `offline`) are
 * the launchers - Ubisoft's counterpart to GOG's playTasks. Only
 * install-relative executables count; register/absolute paths are skipped.
 *
 * Two config generations exist live (both verified Nov 2026): modern titles
 * label entries with `- shortcut_name:` (Anno 2070), older ones start
 * entries with `- path:` and only carry `description:` labels plus optional
 * `arguments:` (AC3, Rayman). Entries may sit at the same indent as their
 * `executables:` key.
 */
export type UbisoftLaunchDocument = {
  name: string;
  executable: string;
  arguments: string[];
};

export function deriveUbisoftLaunches(configYaml: string): {
  title?: string;
  launches: UbisoftLaunchDocument[];
} {
  const lines = configYaml.split(/\r?\n/);
  let title: string | undefined;
  const launches: UbisoftLaunchDocument[] = [];
  const seen = new Set<string>();

  let titleIndent = -1;
  let startGameIndent = -1;
  let blockIndent = -1; // online:/offline: anchor; -2 = skipping this block
  let blockDone = false; // online already produced launches
  let executablesIndent = -1;
  let current: {
    name: string;
    label: string;
    exe: string;
    args: string[];
  } | null = null;
  let inPath = false;

  const finishEntry = () => {
    if (current && current.exe) {
      const key = `${current.name || current.label}\u0000${current.exe}\u0000${current.args.join(" ")}`;
      if (!seen.has(key)) {
        seen.add(key);
        launches.push({
          name: current.name || current.label || "Play",
          executable: current.exe,
          arguments: current.args,
        });
        if (blockIndent >= 0) blockDone = true;
      }
    }
    current = null;
    inPath = false;
  };

  const deeper = (indent: number, anchor: number) =>
    anchor >= 0 && indent > anchor;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const text = line.trim();

    if (startGameIndent < 0) {
      // Before start_game: capture root.name (first `name:` under `root:`).
      if (text === "root:") titleIndent = indent;
      else if (
        title === undefined &&
        deeper(indent, titleIndent) &&
        text.startsWith("name:")
      ) {
        title = stripQuotes(text.slice("name:".length)) || undefined;
      }
      if (text === "start_game:") startGameIndent = indent;
      continue;
    }

    // Inside start_game: leaving the block closes everything above its indent.
    if (indent <= startGameIndent) {
      finishEntry();
      startGameIndent = -1;
      blockIndent = -1;
      blockDone = false;
      executablesIndent = -1;
      continue;
    }
    if (text === "online:" || text === "offline:") {
      finishEntry();
      blockIndent =
        blockDone || (text === "offline:" && launches.length > 0)
          ? -2 // already have launches: skip this whole block
          : indent;
      executablesIndent = -1;
      continue;
    }
    if (blockIndent === -2) continue;
    if (text === "executables:") {
      finishEntry();
      executablesIndent = indent;
      continue;
    }
    // A dash at the key's own indent is a list ITEM of that key (YAML block
    // sequences may share indentation), so it must not close the block.
    const isItem = text.startsWith("- ");
    if (executablesIndent >= 0 && indent <= executablesIndent && !isItem) {
      finishEntry();
      executablesIndent = -1;
    }
    if (executablesIndent < 0) continue;

    const item = isItem ? text.slice(2).trim() : text;
    if (isItem) {
      finishEntry();
      current = { name: "", label: "", exe: "", args: [] };
      if (item === "") continue;
    }
    if (!current) {
      // A config that nests fields without dashes: start an implicit entry.
      current = { name: "", label: "", exe: "", args: [] };
    }

    if (item.startsWith("shortcut_name:")) {
      current.name = stripQuotes(item.slice("shortcut_name:".length));
    } else if (item.startsWith("description:")) {
      current.label =
        current.label || stripQuotes(item.slice("description:".length));
    } else if (item === "path:") {
      inPath = true;
    } else if (item.startsWith("working_directory:")) {
      inPath = false;
    } else if (inPath && item.startsWith("relative:")) {
      current.exe = stripQuotes(
        item
          .slice("relative:".length)
          .replaceAll("\\", "/")
          .replace(/^\/+/, ""),
      );
      inPath = false;
    } else if (
      inPath &&
      (item.startsWith("register:") || item.startsWith("absolute:"))
    ) {
      inPath = false;
    } else if (item.startsWith("arguments:")) {
      const raw = stripQuotes(item.slice("arguments:".length));
      current.args = current.args.concat(
        raw === "" ? [] : raw.split(/\s+/).filter(Boolean),
      );
    }
  }
  finishEntry();
  return { title, launches };
}

/** Trim surrounding quotes from a YAML scalar. */
function stripQuotes(value: string): string {
  return value.trim().replace(/^["'](.*)["']$/, "$1");
}
