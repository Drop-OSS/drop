import { createError } from 'h3'
import { Readable } from 'node:stream'
import { createInflateRaw } from 'node:zlib'
import { stageAdapterRelease, type AdapterFile } from '../adapter/contract'
import type { DropletManifest } from '../depot/manifest'
import { crc32Update, fetchEaZipEntries, fetchEaZipEntryData, type EaZipEntry } from './zip-manifest'

export type EaStreamProgress = { transferredBytes: number; totalBytes: number; currentFile: string; fileIndex: number; totalFiles: number }
export type EaStreamOptions = {
  archiveUrl: string
  objectsDir: string
  manifestsDir: string
  gameTitle: string
  appVersion?: string
  signal?: AbortSignal
  onProgress?: (progress: EaStreamProgress) => void
}

/**
 * Open one ZIP entry as a stream of *decompressed* Buffers.
 *
 * A byte Range request is issued for exactly the compressed extent the central
 * directory declares, and the response is only accepted when the server answered
 * 206 with that precise Content-Range. Deflate entries are inflated raw while
 * streaming; the CRC32 and declared uncompressed size are checked as the stream
 * drains, so a truncated or corrupted entry fails before publication.
 */
async function acquireEaEntry(
  url: string,
  entry: EaZipEntry,
  signal: AbortSignal | undefined
): Promise<AsyncIterable<Buffer>> {
  const header = await fetchEaZipEntryData(url, entry, signal)
  const start = header.offset
  const end = start + entry.compressedSize - 1

  let response: Response | undefined
  if (entry.compressedSize > 0) {
    try {
      response = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}`, Accept: 'application/octet-stream' },
        signal: signal ?? AbortSignal.timeout(60_000),
      })
    } catch {
      throw createError({ statusCode: 502, statusMessage: `Failed to fetch EA ZIP entry ${entry.name}` })
    }
    const range = response.headers.get('content-range')
    if (response.status !== 206 || !range?.startsWith(`bytes ${start}-${end}/`) || !response.body) {
      throw createError({ statusCode: 502, statusMessage: `EA ZIP entry range rejected for ${entry.name}` })
    }
  }

  const source = entry.compressedSize === 0 ? Readable.from([]) : Readable.fromWeb(response!.body as import('node:stream/web').ReadableStream)
  const decoded: AsyncIterable<unknown> = entry.compressionMethod === 8 ? source.pipe(createInflateRaw()) : source

  async function* verified(): AsyncGenerator<Buffer> {
    let crc = 0
    let size = 0
    try {
      for await (const part of decoded) {
        const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part as Uint8Array)
        size += bytes.length
        if (size > entry.uncompressedSize) {
          throw createError({ statusCode: 502, statusMessage: `EA ZIP entry exceeded declared size: ${entry.name}` })
        }
        crc = crc32Update(crc, bytes)
        yield bytes
      }
    } catch (error) {
      source.destroy()
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw createError({ statusCode: 502, statusMessage: `Failed to decompress EA ZIP entry ${entry.name}` })
    }
    if (size !== entry.uncompressedSize) {
      throw createError({ statusCode: 502, statusMessage: `EA ZIP entry size mismatch for ${entry.name}` })
    }
    if (crc !== entry.crc32) {
      throw createError({ statusCode: 502, statusMessage: `EA ZIP entry CRC32 mismatch for ${entry.name}` })
    }
  }

  return verified()
}

/**
 * Stream every file in an EA ZIP archive straight into the depot CAS. Nothing is
 * published unless all entries pass their CRC32 and size checks; chunking,
 * digest computation and atomic manifest publication come from the shared
 * adapter contract.
 */
export async function streamEaGameToCas(options: EaStreamOptions): Promise<{ manifest: DropletManifest; manifestPath: string }> {
  const { archiveUrl, objectsDir, manifestsDir, gameTitle, appVersion, signal, onProgress } = options

  if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'EA ingestion stream was aborted' })

  const entries = await fetchEaZipEntries(archiveUrl, signal)
  const files: AdapterFile[] = []
  const entriesByFileId = new Map<string, EaZipEntry>()
  const seen = new Set<string>()

  for (const entry of entries) {
    // Directory markers carry no content.
    if (entry.name.endsWith('/')) continue
    const path = entry.name.replace(/\\/g, '/').normalize('NFC')
    if (!path || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some((part) => part === '..' || part === '.')) {
      throw createError({ statusCode: 502, statusMessage: `Unsafe EA ZIP entry path: ${entry.name}` })
    }
    if (seen.has(path)) throw createError({ statusCode: 502, statusMessage: `Duplicate EA ZIP path: ${path}` })
    seen.add(path)
    const fileId = `${files.length}:${entry.name}`
    entriesByFileId.set(fileId, entry)
    files.push({ fileId, path, size: entry.uncompressedSize })
  }

  const { manifest, manifestPath } = await stageAdapterRelease({
    gameTitle,
    appVersion,
    files,
    objectsDir,
    manifestsDir,
    signal,
    onProgress: (progress) =>
      onProgress?.({
        transferredBytes: progress.transferredBytes,
        totalBytes: progress.totalBytes,
        currentFile: progress.currentFile,
        fileIndex: progress.fileIndex,
        totalFiles: progress.totalFiles,
      }),
    acquire: async (file, acquireSignal) => {
      const entry = entriesByFileId.get(file.fileId)
      if (!entry) throw createError({ statusCode: 500, statusMessage: `No EA ZIP entry for adapter file ${file.fileId}` })
      return acquireEaEntry(archiveUrl, entry, acquireSignal)
    },
  })

  return { manifest, manifestPath }
}
