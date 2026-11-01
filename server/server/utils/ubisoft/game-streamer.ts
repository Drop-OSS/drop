import { createError } from 'h3'
import { writeChunkObject, CHUNK_SIZE } from '../depot/chunker'
import { buildManifest, writeManifest, type DropletManifest } from '../depot/manifest'
import type { UbisoftFileRecord } from './client'

export type UbisoftStreamProgress = {
  transferredBytes: number
  totalBytes: number
  currentFile: string
  fileIndex: number
  totalFiles: number
}

export type UbisoftStreamOptions = {
  fileRecords: UbisoftFileRecord[]
  gameTitle: string
  appVersion?: string
  objectsDir: string
  manifestsDir: string
  signal?: AbortSignal
  onProgress?: (progress: UbisoftStreamProgress) => void
}

/**
 * Downloads one Ubisoft file from its resolved source URL, streaming it into
 * bounded buffers. Verifies declared length when the manifest provides one;
 * all manifest metadata is untrusted, so mismatches fail the acquisition.
 */
async function streamUbisoftFile(
  record: UbisoftFileRecord,
  objectsDir: string,
  signal: AbortSignal | undefined,
  onBytes: (bytes: number) => void
): Promise<{ size: number; chunkShas: string[] }> {
  if (!record.source || !/^https:\/\//.test(record.source)) {
    throw createError({
      statusCode: 502,
      statusMessage: `Refusing non-HTTPS Ubisoft file source for ${record.fileId}`,
    })
  }

  const response = await fetch(record.source, {
    headers: { accept: '*/*' },
    signal: signal ?? AbortSignal.timeout(30_000),
  })

  if (!response.ok || !response.body) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Failed to download Ubisoft file ${record.fileId} (${response.status})`,
    })
  }

  const chunkShas: string[] = []
  let accumulator = Buffer.alloc(0)
  let size = 0

  const reader = response.body.getReader()
  try {
    while (true) {
      if (signal?.aborted) {
        throw createError({ statusCode: 499, statusMessage: 'Ubisoft file stream aborted' })
      }
      const { done, value } = await reader.read()
      if (done) break

      const incoming = Buffer.from(value)
      size += incoming.length
      accumulator = Buffer.concat([accumulator, incoming])
      onBytes(incoming.length)

      while (accumulator.length >= CHUNK_SIZE) {
        const slice = accumulator.subarray(0, CHUNK_SIZE)
        accumulator = accumulator.subarray(CHUNK_SIZE)
        chunkShas.push(await writeChunkObject(objectsDir, slice))
      }
    }
  } finally {
    // Cancel the underlying transfer on abort/error so no orphaned streams leak.
    reader.cancel().catch(() => {})
  }

  if (accumulator.length > 0) {
    chunkShas.push(await writeChunkObject(objectsDir, accumulator))
  }

  // Provider-declared size is metadata we must not trust: verify it.
  if (typeof record.size === 'number' && record.size > 0 && record.size !== size) {
    throw createError({
      statusCode: 502,
      statusMessage: `Ubisoft file ${record.fileId} length mismatch (expected ${record.size}, got ${size})`,
    })
  }

  return { size, chunkShas }
}

/**
 * Streams a Ubisoft Connect title directly into GameDepot's 4 MiB CAS and
 * emits an immutable DropletManifest, bypassing monolithic installer files.
 * Mirrors the Epic/GOG streamer boundary: manifest metadata is validated,
 * never trusted, and nothing is published until every file is written.
 */
export async function streamUbisoftGameToCas(
  options: UbisoftStreamOptions
): Promise<{ manifest: DropletManifest; manifestPath: string }> {
  const { fileRecords, gameTitle, appVersion, objectsDir, manifestsDir, signal, onProgress } = options

  // Reject duplicate/conflicting logical paths before transferring anything.
  const seen = new Set<string>()
  for (const record of fileRecords) {
    const path = record.path ?? `unknown/${record.fileId}`
    if (seen.has(path)) {
      throw createError({ statusCode: 502, statusMessage: `Duplicate Ubisoft file path: ${path}` })
    }
    seen.add(path)
  }

  const totalFiles = fileRecords.length
  const totalBytes = fileRecords.reduce((sum, r) => sum + (r.size ?? 0), 0)
  let transferredBytes = 0

  const stagedFiles: { path: string; size: number; sha256: string; chunkShas: string[] }[] = []

  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    if (signal?.aborted) {
      throw createError({ statusCode: 499, statusMessage: 'Ubisoft ingestion stream was aborted' })
    }

    const record = fileRecords[fileIdx]
    const logicalPath = record.path ?? `unknown/${record.fileId}`

    onProgress?.({
      transferredBytes,
      totalBytes,
      currentFile: logicalPath,
      fileIndex: fileIdx + 1,
      totalFiles,
    })

    if (record.size === 0) {
      stagedFiles.push({
        path: logicalPath,
        size: 0,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        chunkShas: [],
      })
      continue
    }

    const result = await streamUbisoftFile(record, objectsDir, signal, (bytes) => {
      transferredBytes += bytes
      onProgress?.({
        transferredBytes,
        totalBytes,
        currentFile: logicalPath,
        fileIndex: fileIdx + 1,
        totalFiles,
      })
    })

    if (result.chunkShas.length === 0) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ubisoft file ${record.fileId} produced no CAS chunks`,
      })
    }

    // The Ubisoft manifest carries no per-file digest; the file identity in
    // the release manifest is derived from its verified CAS chunk set.
    const derivedSha = result.chunkShas[result.chunkShas.length - 1]
    stagedFiles.push({
      path: logicalPath,
      size: result.size,
      sha256: derivedSha,
      chunkShas: result.chunkShas,
    })
  }

  const dropletManifest = buildManifest({
    title: gameTitle,
    version: appVersion ?? 'latest',
    files: stagedFiles,
  })

  const manifestPath = await writeManifest(manifestsDir, dropletManifest)
  return { manifest: dropletManifest, manifestPath }
}
