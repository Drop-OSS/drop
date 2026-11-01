import { createError } from 'h3'
import { stageAdapterRelease, type AdapterFile } from '../adapter/contract'
import type { DropletManifest } from '../depot/manifest'
import {
  fetchEpicManifestDownloadUrls,
  fetchEpicManifestBuffer,
  parseEpicBinaryManifest,
  type EpicAssetManifestInfo,
  type EpicParsedFile,
} from './manifest'

export type EpicStreamProgress = {
  transferredBytes: number
  totalBytes: number
  currentFile: string
  fileIndex: number
  totalFiles: number
}

export type EpicStreamOptions = {
  assetInfo: EpicAssetManifestInfo
  accessToken: string
  objectsDir: string
  manifestsDir: string
  gameTitle: string
  appVersion?: string
  signal?: AbortSignal
  onProgress?: (progress: EpicStreamProgress) => void
}

/**
 * Downloads an individual Epic chunk from the provided base URLs, attempting
 * mirrors sequentially, and returns the raw chunk bytes.
 */
async function downloadEpicChunk(
  chunkGuid: string,
  baseUrls: string[],
  signal?: AbortSignal
): Promise<Buffer> {
  const normalizedGuid = chunkGuid.replace(/-/g, '').toLowerCase()
  // Epic chunks are typically organized as /ChunksV4/{group}/{hash}.chunk
  // or /{hash}.chunk depending on manifest version.
  const pathVariants = [
    `ChunksV4/${normalizedGuid.slice(0, 2)}/${normalizedGuid}.chunk`,
    `${normalizedGuid}.chunk`,
  ]

  let lastError: Error | null = null

  for (const baseUrl of baseUrls) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

    for (const variant of pathVariants) {
      if (signal?.aborted) {
        throw createError({ statusCode: 499, statusMessage: 'Epic chunk stream aborted' })
      }

      const chunkUrl = `${cleanBase}/${variant}`
      try {
        const response = await fetch(chunkUrl, {
          headers: { accept: '*/*' },
          signal: signal ?? AbortSignal.timeout(15_000),
        })

        if (!response.ok) {
          continue
        }

        return Buffer.from(await response.arrayBuffer())
      } catch (err) {
        lastError = err as Error
      }
    }
  }

  throw createError({
    statusCode: 502,
    statusMessage: `Failed to download Epic chunk ${chunkGuid}: ${lastError?.message ?? 'no mirrors reachable'}`,
  })
}

/** Assemble one logical file by streaming its manifest chunks in order. */
async function* downloadEpicFile(
  file: EpicParsedFile,
  baseUrls: string[],
  signal: AbortSignal | undefined
): AsyncGenerator<Buffer> {
  for (const chunk of file.chunks) {
    yield await downloadEpicChunk(chunk.guid, baseUrls, signal)
  }
}

/**
 * Streams an Epic Games title directly into GameDepot's Content-Addressable
 * Storage (CAS) and generates a DropletManifest, bypassing installer files.
 *
 * Chunk re-framing, size/digest verification and atomic publication are the
 * shared adapter contract's responsibility; this module only knows Epic's
 * manifest endpoint, mirror layout and chunk addressing.
 */
export async function streamEpicGameToCas(
  options: EpicStreamOptions
): Promise<{ manifest: DropletManifest; manifestPath: string }> {
  const { assetInfo, accessToken, objectsDir, manifestsDir, gameTitle, appVersion, signal, onProgress } = options

  if (signal?.aborted) {
    throw createError({ statusCode: 499, statusMessage: 'Epic ingestion stream was aborted' })
  }

  // 1. Resolve manifest location and chunk mirrors. 2. Fetch manifest bytes.
  // 3. Decode it (see utils/epic/manifest for the decoding status).
  const downloadInfo = await fetchEpicManifestDownloadUrls(assetInfo, accessToken)
  const manifestBuffer = await fetchEpicManifestBuffer(downloadInfo.manifestDownloadUrl, signal)
  const parsedManifest = parseEpicBinaryManifest(manifestBuffer)

  const files: AdapterFile[] = []
  const filesById = new Map<string, EpicParsedFile>()
  const seenPaths = new Set<string>()
  for (const file of parsedManifest.files) {
    if (seenPaths.has(file.path)) {
      throw createError({ statusCode: 502, statusMessage: `Duplicate Epic file path: ${file.path}` })
    }
    seenPaths.add(file.path)
    const fileId = `${files.length}:${file.path}`
    filesById.set(fileId, file)
    files.push({ fileId, path: file.path, size: file.size, sha256: file.sha256 })
  }

  const { manifest, manifestPath } = await stageAdapterRelease({
    gameTitle,
    appVersion: appVersion ?? parsedManifest.appVersion ?? 'latest',
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
      const parsed = filesById.get(file.fileId)
      if (!parsed) {
        throw createError({ statusCode: 500, statusMessage: `No Epic manifest entry for adapter file ${file.fileId}` })
      }
      return downloadEpicFile(parsed, downloadInfo.chunkBaseUrls, acquireSignal)
    },
  })

  return { manifest, manifestPath }
}
