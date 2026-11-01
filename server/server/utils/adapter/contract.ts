import { createError } from 'h3'
import { createHash } from 'node:crypto'
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEPOT_CHUNK_SIZE, type DepotChunk } from '../depot/chunker'
import { createDropletManifest, writeDropletManifest, type DropletManifest } from '../depot/manifest'

/**
 * Shared provider-adapter contract: authorize -> discover -> normalize ->
 * acquire -> verify -> publish. Provider-specific code (OAuth, manifests,
 * remote ZIP parsing) stays inside each adapter; this module standardizes
 * the pipeline boundary, CAS streaming, verification gating and manifest
 * publication shared by GOG, Epic, Ubisoft, EA and manual import.
 */

export type AdapterPhase = 'authorize' | 'discover' | 'normalize' | 'acquire' | 'verify' | 'publish'

export interface AdapterProgress {
  phase: AdapterPhase
  currentFile: string
  fileIndex: number
  totalFiles: number
  transferredBytes: number
  totalBytes: number
}

/** A provider-resolved file ready for acquisition; metadata is untrusted. */
export interface AdapterFile {
  /** Stable provider file identifier (provenance). */
  fileId: string
  /** Logical relative path within the release; validated before transfer. */
  path: string
  /** Provider-declared byte size, verified after transfer when present. */
  size?: number
  /** Provider-declared digest; verified when present. */
  sha256?: string
}

export interface StagedFile {
  path: string
  size: number
  sha256: string
  chunks: DepotChunk[]
  sourceFileId: string
}

export interface AdapterStageOptions {
  gameTitle: string
  appVersion?: string
  files: AdapterFile[]
  objectsDir: string
  manifestsDir: string
  signal?: AbortSignal
  onProgress?: (progress: AdapterProgress) => void
  /**
   * Provider acquisition callback: stream the raw bytes for one file.
   * Throwing fails the whole ingestion; nothing is published on failure.
   */
  acquire: (file: AdapterFile, signal: AbortSignal | undefined) => Promise<AsyncIterable<Buffer>>
}

export type StagedRelease = {
  manifest: DropletManifest
  manifestPath: string
  files: StagedFile[]
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

/** Validate a logical manifest path: relative, normalized, traversal-free. */
export function safeLogicalPath(name: string): string {
  const path = name.replace(/\\/g, '/').normalize('NFC')
  if (
    !path ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw createError({ statusCode: 502, statusMessage: `Unsafe adapter file path: ${name}` })
  }
  return path
}

/** Write one immutable raw chunk object into the depot CAS, mirroring chunker.ts layout. */
async function writeCasObject(objectsDir: string, data: Buffer): Promise<{ sha256: string; object: string }> {
  const sha256 = createHash('sha256').update(data).digest('hex')
  const object = join(objectsDir, sha256.slice(0, 2), sha256)
  await mkdir(dirname(object), { recursive: true })
  try {
    await stat(object)
  } catch {
    const temp = `${object}.${process.pid}.${Date.now()}.tmp`
    const handle = await open(temp, 'wx')
    try {
      await handle.writeFile(data)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await rename(temp, object)
    } catch (error) {
      await unlink(temp).catch(() => {})
      try {
        await stat(object)
      } catch {
        throw error
      }
    }
  }
  return { sha256, object: `objects/${sha256.slice(0, 2)}/${sha256}` }
}

/** Stream raw bytes from the acquire callback into bounded CAS chunks. */
async function streamFileToCas(
  objectsDir: string,
  source: AsyncIterable<Buffer>,
  signal: AbortSignal | undefined,
  onBytes?: (bytes: number) => void
): Promise<{ size: number; sha256: string; chunks: DepotChunk[] }> {
  const hash = createHash('sha256')
  const chunks: DepotChunk[] = []
  let pending = Buffer.alloc(0)
  let offset = 0
  let index = 0
  let size = 0
  for await (const part of source) {
    if (signal?.aborted) {
      throw createError({ statusCode: 499, statusMessage: 'Adapter file stream aborted' })
    }
    const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += bytes.length
    hash.update(bytes)
    onBytes?.(bytes.length)
    pending = pending.length ? Buffer.concat([pending, bytes]) : bytes
    while (pending.length >= DEPOT_CHUNK_SIZE) {
      const data = pending.subarray(0, DEPOT_CHUNK_SIZE)
      pending = pending.subarray(DEPOT_CHUNK_SIZE)
      const { sha256, object } = await writeCasObject(objectsDir, data)
      chunks.push({ index: index++, offset, size: data.length, sha256, object })
      offset += data.length
    }
  }
  if (pending.length) {
    const { sha256, object } = await writeCasObject(objectsDir, pending)
    chunks.push({ index: index++, offset, size: pending.length, sha256, object })
    offset += pending.length
  }
  return { size, sha256: hash.digest('hex'), chunks }
}

/**
 * Shared acquire -> verify -> publish stage. Duplicate logical paths are
 * rejected before any byte is transferred; provider-declared sizes and
 * digests are verified (never trusted); and the DropletManifest is only
 * written after every file passes its checks.
 */
export async function stageAdapterRelease(options: AdapterStageOptions): Promise<StagedRelease> {
  const { gameTitle, appVersion, files, objectsDir, manifestsDir, signal, onProgress, acquire } = options

  const seen = new Set<string>()
  const normalized: AdapterFile[] = []
  for (const file of files) {
    const path = safeLogicalPath(file.path)
    if (seen.has(path)) {
      throw createError({ statusCode: 502, statusMessage: `Duplicate adapter file path: ${path}` })
    }
    seen.add(path)
    normalized.push({ ...file, path })
  }

  const totalFiles = normalized.length
  const totalBytes = normalized.reduce((sum, f) => sum + (f.size ?? 0), 0)
  let transferredBytes = 0
  const staged: StagedFile[] = []

  for (let i = 0; i < totalFiles; i++) {
    if (signal?.aborted) {
      throw createError({ statusCode: 499, statusMessage: 'Adapter ingestion stream was aborted' })
    }
    const file = normalized[i]
    const report = () =>
      onProgress?.({
        phase: 'acquire',
        currentFile: file.path,
        fileIndex: i + 1,
        totalFiles,
        transferredBytes,
        totalBytes,
      })
    report()

    if (file.size === 0) {
      staged.push({ path: file.path, size: 0, sha256: EMPTY_SHA256, chunks: [], sourceFileId: file.fileId })
      continue
    }

    const source = await acquire(file, signal)
    const result = await streamFileToCas(objectsDir, source, signal, (n) => {
      transferredBytes += n
      report()
    })

    // Provider-declared metadata is verified, never trusted.
    if (typeof file.size === 'number' && file.size > 0 && file.size !== result.size) {
      throw createError({
        statusCode: 502,
        statusMessage: `Adapter file ${file.fileId} length mismatch (expected ${file.size}, got ${result.size})`,
      })
    }
    if (file.sha256 && file.sha256.toLowerCase() !== result.sha256) {
      throw createError({ statusCode: 502, statusMessage: `Adapter file ${file.fileId} digest mismatch` })
    }

    staged.push({
      path: file.path,
      size: result.size,
      sha256: result.sha256,
      chunks: result.chunks,
      sourceFileId: file.fileId,
    })
  }

  onProgress?.({
    phase: 'publish',
    currentFile: '',
    fileIndex: totalFiles,
    totalFiles,
    transferredBytes,
    totalBytes,
  })

  const manifest = createDropletManifest(
    staged.map((f) => ({ path: f.path, content: { size: f.size, sha256: f.sha256, chunks: f.chunks } }))
  )
  const manifestPath = join(manifestsDir, `${manifest.digest}.json`)
  await writeDropletManifest(manifestPath, manifest)
  return { manifest, manifestPath, files: staged }
}