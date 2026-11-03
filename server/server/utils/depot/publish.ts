import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { chunkFileToCas, type ChunkFileResult } from "./chunker";
import { createDropletManifest, writeDropletManifest } from "./manifest";
import { casManifestPath } from "./paths";

/** A runaway tree is a bug to report, not a job that hangs forever. */
const MAX_FILES = 200_000;
/** Names the manifest cannot carry safely: a backslash would turn one real file
 *  into two logical path segments, and a NUL breaks every consumer. */
const UNSAFE_NAME = /[\\\0]/;

export type CasPublishResult = {
  /** Self-digest of the written manifest, and its filename. */
  digest: string;
  fileCount: number;
  /** Distinct chunk objects the release needs (repeats dedupe to one). */
  chunkCount: number;
  totalBytes: number;
  manifestPath: string;
};

export type CasPublishOptions = {
  /** Directory whose contents become the release, read-only for us. */
  sourceDir: string;
  /** Root holding `objects/` and `manifests/`. */
  depotRoot: string;
  signal?: AbortSignal;
  onProgress?: (doneBytes: number, totalBytes: number) => void;
};

type CollectedFile = {
  /** Logical manifest path: relative, posix separators, no traversal. */
  path: string;
  absolute: string;
  size: number;
  /** Permission bits, so a client can assemble a runnable install. */
  mode: number;
};

async function walk(dir: string, prefix: string, out: CollectedFile[]) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (out.length >= MAX_FILES)
      throw new Error(`Refusing to publish more than ${MAX_FILES} files`);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = join(dir, entry.name);
    // A symlink would publish bytes from outside the release, and following it
    // can loop; anything that is neither a file nor a directory (a socket, a
    // device) has no bytes a client could restore. Both are refused, not skipped:
    // silence here would mean a release that quietly installs short.
    if (entry.isSymbolicLink())
      throw new Error(`Refusing to publish symlink: ${relative}`);
    if (entry.isDirectory()) {
      await walk(absolute, relative, out);
      continue;
    }
    if (!entry.isFile())
      throw new Error(`Unsupported entry in release source: ${relative}`);
    if (UNSAFE_NAME.test(entry.name))
      throw new Error(`Unsafe file name in release source: ${relative}`);
    const info = await stat(absolute);
    out.push({
      path: relative,
      absolute,
      size: info.size,
      mode: info.mode & 0o7777,
    });
  }
}

/**
 * Chunk every file under `sourceDir` into the content-addressed store and
 * publish the `gamedepot-droplet` manifest that describes the result.
 *
 * The same tree always yields the same digest: files are ordered by path,
 * chunked at a fixed size, and a chunk already in the store is reused rather
 * than rewritten, so publishing a second version of a game pays only for what
 * actually changed. Nothing is renamed into place half-done — the manifest is
 * the last write, so a manifest on disk always describes complete bytes.
 */
export async function publishDirectoryToCas(
  options: CasPublishOptions,
): Promise<CasPublishResult> {
  const files: CollectedFile[] = [];
  await walk(options.sourceDir, "", files);
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  if (files.length === 0)
    throw new Error(`No files to publish under ${options.sourceDir}`);

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const chunked: Array<{
    path: string;
    mode: number;
    content: ChunkFileResult;
  }> = [];
  let doneBytes = 0;
  for (const file of files) {
    if (options.signal?.aborted)
      throw options.signal.reason ?? new Error("Chunking aborted");
    const base = doneBytes;
    const content = await chunkFileToCas(file.absolute, options.depotRoot, {
      ...(options.signal ? { signal: options.signal } : {}),
      onProgress: (bytes) => options.onProgress?.(base + bytes, totalBytes),
    });
    doneBytes += file.size;
    chunked.push({ path: file.path, mode: file.mode, content });
  }

  const manifest = createDropletManifest(chunked);
  const manifestPath = casManifestPath(options.depotRoot, manifest.digest);
  await writeDropletManifest(manifestPath, manifest);
  return {
    digest: manifest.digest,
    fileCount: files.length,
    chunkCount: Object.keys(manifest.chunkIndex).length,
    totalBytes,
    manifestPath,
  };
}
