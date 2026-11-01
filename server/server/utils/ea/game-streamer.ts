import { createError } from 'h3'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { createInflateRaw } from 'node:zlib'
import { writeChunkObject, CHUNK_SIZE } from '../depot/chunker'
import { buildManifest, writeManifest, type DropletManifest } from '../depot/manifest'
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

function checkedPath(name: string): string {
  const path = name.replace(/\\/g, '/').normalize('NFC')
  if (!path || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some((part) => part === '..' || part === '.')) {
    throw createError({ statusCode: 502, statusMessage: `Unsafe EA ZIP entry path: ${name}` })
  }
  return path
}

async function streamEntry(url: string, entry: EaZipEntry, objectsDir: string, signal?: AbortSignal, onBytes?: (n: number) => void): Promise<{ size: number; sha256: string; chunkShas: string[] }> {
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
  const decoded = entry.compressionMethod === 8 ? source.pipe(createInflateRaw()) : source
  const hash = createHash('sha256')
  const chunkShas: string[] = []
  let pending = Buffer.alloc(0)
  let size = 0
  let crc = 0
  try {
    for await (const part of decoded) {
      if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'EA ZIP entry stream aborted' })
      const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part)
      size += bytes.length
      if (size > entry.uncompressedSize) throw createError({ statusCode: 502, statusMessage: `EA ZIP entry exceeded declared size: ${entry.name}` })
      crc = crc32Update(crc, bytes)
      hash.update(bytes)
      onBytes?.(bytes.length)
      pending = pending.length ? Buffer.concat([pending, bytes]) : bytes
      while (pending.length >= CHUNK_SIZE) {
        const chunk = pending.subarray(0, CHUNK_SIZE)
        pending = pending.subarray(CHUNK_SIZE)
        chunkShas.push(await writeChunkObject(objectsDir, chunk))
      }
    }
  } catch (error) {
    source.destroy()
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: `Failed to decompress EA ZIP entry ${entry.name}` })
  }
  if (size !== entry.uncompressedSize) throw createError({ statusCode: 502, statusMessage: `EA ZIP entry size mismatch for ${entry.name}` })
  if (crc !== entry.crc32) throw createError({ statusCode: 502, statusMessage: `EA ZIP entry CRC32 mismatch for ${entry.name}` })
  if (pending.length) chunkShas.push(await writeChunkObject(objectsDir, pending))
  return { size, sha256: hash.digest('hex'), chunkShas }
}

/** Stream all ZIP files into CAS. No manifest is published unless all entry CRCs pass. */
export async function streamEaGameToCas(options: EaStreamOptions): Promise<{ manifest: DropletManifest; manifestPath: string }> {
  const { archiveUrl, objectsDir, manifestsDir, gameTitle, appVersion, signal, onProgress } = options
  const entries = await fetchEaZipEntries(archiveUrl, signal)
  const files = entries.filter((entry) => !entry.name.endsWith('/'))
  const seen = new Set<string>()
  for (const entry of files) {
    const path = checkedPath(entry.name)
    if (seen.has(path)) throw createError({ statusCode: 502, statusMessage: `Duplicate EA ZIP path: ${path}` })
    seen.add(path)
  }
  const totalBytes = files.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
  let transferredBytes = 0
  const stagedFiles: { path: string; size: number; sha256: string; chunkShas: string[] }[] = []
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'EA ingestion stream was aborted' })
    const entry = files[i]
    const path = checkedPath(entry.name)
    onProgress?.({ transferredBytes, totalBytes, currentFile: path, fileIndex: i + 1, totalFiles: files.length })
    const result = await streamEntry(archiveUrl, entry, objectsDir, signal, (n) => {
      transferredBytes += n
      onProgress?.({ transferredBytes, totalBytes, currentFile: path, fileIndex: i + 1, totalFiles: files.length })
    })
    stagedFiles.push({ path, size: result.size, sha256: result.sha256, chunkShas: result.chunkShas })
  }
  const manifest = buildManifest({ title: gameTitle, version: appVersion ?? 'latest', files: stagedFiles })
  const manifestPath = await writeManifest(manifestsDir, manifest)
  return { manifest, manifestPath }
}
