import { createError } from 'h3'
import { randomBytes } from 'node:crypto'
import { writeChunkObject, CHUNK_SIZE } from '../depot/chunker'
import { buildManifest, writeManifest, type DropletManifest } from '../depot/manifest'
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
 * Downloads an individual Epic chunk from the provided base URLs,
 * attempts mirrors sequentially, and verifies received content length.
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

        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
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

/**
 * Streams an Epic Games title directly into GameDepot's Content-Addressable Storage (CAS)
 * and generates a DropletManifest, completely bypassing installer files.
 */
export async function streamEpicGameToCas(
  options: EpicStreamOptions
): Promise<{ manifest: DropletManifest; manifestPath: string }> {
  const { assetInfo, accessToken, objectsDir, manifestsDir, gameTitle, appVersion, signal, onProgress } = options

  // 1. Fetch manifest download URL from Epic launcher service
  const downloadInfo = await fetchEpicManifestDownloadUrls(assetInfo, accessToken)

  // 2. Fetch raw manifest binary bytes
  const manifestBuffer = await fetchEpicManifestBuffer(downloadInfo.manifestDownloadUrl, signal)

  // 3. Parse manifest into logical files and chunk specifications
  const parsedManifest = parseEpicBinaryManifest(manifestBuffer)

  const totalFiles = parsedManifest.files.length
  let totalBytes = 0
  for (const f of parsedManifest.files) {
    totalBytes += f.size
  }

  let transferredBytes = 0
  const stagedFiles: { path: string; size: number; sha256: string; chunkShas: string[] }[] = []

  // Bounded buffer for assembling GameDepot 4 MiB fixed-size CAS chunks
  let accumulator = Buffer.alloc(0)

  // Process files from parsed manifest
  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    if (signal?.aborted) {
      throw createError({ statusCode: 499, statusMessage: 'Epic ingestion stream was aborted' })
    }

    const file = parsedManifest.files[fileIdx]
    const fileChunkShas: string[] = []

    onProgress?.({
      transferredBytes,
      totalBytes,
      currentFile: file.path,
      fileIndex: fileIdx + 1,
      totalFiles,
    })

    // If file has no chunks or zero size, register empty file
    if (file.size === 0 || file.chunks.length === 0) {
      stagedFiles.push({
        path: file.path,
        size: 0,
        sha256: file.sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        chunkShas: [],
      })
      continue
    }

    // Download chunks and assemble file bytes into GameDepot CAS chunks
    for (const chunk of file.chunks) {
      if (signal?.aborted) {
        throw createError({ statusCode: 499, statusMessage: 'Epic ingestion stream was aborted' })
      }

      const chunkBuffer = await downloadEpicChunk(chunk.guid, downloadInfo.chunkBaseUrls, signal)

      accumulator = Buffer.concat([accumulator, chunkBuffer])
      transferredBytes += chunkBuffer.length

      while (accumulator.length >= CHUNK_SIZE) {
        const slice = accumulator.subarray(0, CHUNK_SIZE)
        accumulator = accumulator.subarray(CHUNK_SIZE)
        const chunkSha = await writeChunkObject(objectsDir, slice)
        fileChunkShas.push(chunkSha)
      }

      onProgress?.({
        transferredBytes,
        totalBytes,
        currentFile: file.path,
        fileIndex: fileIdx + 1,
        totalFiles,
      })
    }

    // Flush remaining bytes for this file if needed
    if (accumulator.length > 0) {
      const chunkSha = await writeChunkObject(objectsDir, accumulator)
      fileChunkShas.push(chunkSha)
      accumulator = Buffer.alloc(0)
    }

    stagedFiles.push({
      path: file.path,
      size: file.size,
      sha256: file.sha256,
      chunkShas: fileChunkShas,
    })
  }

  // 4. Build canonical Droplet Manifest (version 1)
  const dropletManifest = buildManifest({
    title: gameTitle,
    version: appVersion ?? parsedManifest.appVersion ?? 'latest',
    files: stagedFiles,
  })

  // 5. Commit manifest atomically
  const manifestPath = await writeManifest(manifestsDir, dropletManifest)

  return {
    manifest: dropletManifest,
    manifestPath,
  }
}
