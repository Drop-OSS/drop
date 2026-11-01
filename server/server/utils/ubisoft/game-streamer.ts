import { createError } from 'h3'
import { stageAdapterRelease, type AdapterFile } from '../adapter/contract'
import type { DropletManifest } from '../depot/manifest'
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
 * Open one Ubisoft file source as a stream of Buffers. All manifest metadata is
 * untrusted, so the declared length is verified by the adapter contract after
 * transfer, and non-HTTPS sources are refused outright.
 */
async function acquireUbisoftFile(
  record: UbisoftFileRecord,
  signal: AbortSignal | undefined
): Promise<AsyncIterable<Buffer>> {
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

  const reader = response.body.getReader()

  async function* bytes(): AsyncGenerator<Buffer> {
    try {
      while (true) {
        if (signal?.aborted) {
          throw createError({ statusCode: 499, statusMessage: 'Ubisoft file stream aborted' })
        }
        const { done, value } = await reader.read()
        if (done) break
        yield Buffer.from(value)
      }
    } finally {
      // Cancel the underlying transfer on abort/error so no orphaned streams leak.
      reader.cancel().catch(() => {})
    }
  }

  return bytes()
}

/**
 * Streams a Ubisoft Connect title directly into GameDepot's CAS and emits an
 * immutable DropletManifest, bypassing monolithic installer files.
 *
 * Chunking, length/digest verification and atomic publication are the shared
 * adapter contract's job (`stageAdapterRelease`); this module only maps Ubisoft
 * file records onto adapter files and knows how to open their sources.
 */
export async function streamUbisoftGameToCas(
  options: UbisoftStreamOptions
): Promise<{ manifest: DropletManifest; manifestPath: string }> {
  const { fileRecords, gameTitle, appVersion, objectsDir, manifestsDir, signal, onProgress } = options

  if (signal?.aborted) {
    throw createError({ statusCode: 499, statusMessage: 'Ubisoft ingestion stream was aborted' })
  }

  // Reject duplicate logical paths before transferring anything. The manifest
  // builder also fails closed, but failing here avoids a doomed download.
  const recordsById = new Map<string, UbisoftFileRecord>()
  const seenPaths = new Set<string>()
  const files: AdapterFile[] = fileRecords.map((record) => {
    const path = record.path ?? `unknown/${record.fileId}`
    if (seenPaths.has(path)) {
      throw createError({ statusCode: 502, statusMessage: `Duplicate Ubisoft file path: ${path}` })
    }
    seenPaths.add(path)
    recordsById.set(record.fileId, record)
    // The Ubisoft manifest carries no per-file digest, so the contract verifies
    // the declared size and records the digest it computes during transfer.
    return { fileId: record.fileId, path, size: record.size }
  })

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
      const record = recordsById.get(file.fileId)
      if (!record) {
        throw createError({ statusCode: 500, statusMessage: `No Ubisoft record for adapter file ${file.fileId}` })
      }
      return acquireUbisoftFile(record, acquireSignal)
    },
  })

  return { manifest, manifestPath }
}
