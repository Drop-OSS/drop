import { createError } from 'h3'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  streamEpicGameToCas,
  type EpicStreamProgress,
} from '../../utils/epic/game-streamer'
import type { EpicAssetManifestInfo } from '../../utils/epic/manifest'
import { refreshEpicToken } from '../../utils/epic/client'

export interface EpicIngestJobPayload {
  jobId: string
  accountId: string
  assetInfo: EpicAssetManifestInfo
  accessToken: string
  refreshToken?: string
  gameTitle: string
  appVersion?: string
}

export interface IngestJobStore {
  updateStatus: (jobId: string, status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed', error?: string) => Promise<void>
  updateProgress: (jobId: string, progress: { transferredBytes: number; totalBytes: number; currentFile: string }) => Promise<void>
  setCompleted: (jobId: string, result: { manifestPath: string; totalBytes: number; fileCount: number }) => Promise<void>
}

/**
 * Executes direct stream ingestion of an Epic Games title into GameDepot Content-Addressable Storage (CAS).
 */
export async function ingestEpicJob(
  payload: EpicIngestJobPayload,
  jobStore?: IngestJobStore,
  signal?: AbortSignal
): Promise<{ manifestPath: string; totalBytes: number; fileCount: number }> {
  const { jobId, assetInfo, gameTitle, appVersion } = payload
  let { accessToken } = payload

  // Base storage paths for GameDepot depot CAS
  const depotBase = resolve(process.env.GAMEDEPOT_DATA_DIR || './data', 'depot')
  const objectsDir = resolve(depotBase, 'objects')
  const manifestsDir = resolve(depotBase, 'manifests')

  await mkdir(objectsDir, { recursive: true })
  await mkdir(manifestsDir, { recursive: true })

  if (jobStore) {
    await jobStore.updateStatus(jobId, 'downloading')
  }

  let totalBytesTransferred = 0

  const onProgress = (progress: EpicStreamProgress) => {
    totalBytesTransferred = progress.transferredBytes
    if (jobStore) {
      jobStore.updateProgress(jobId, {
        transferredBytes: progress.transferredBytes,
        totalBytes: progress.totalBytes,
        currentFile: progress.currentFile,
      }).catch(() => {
        // non-blocking progress updates
      })
    }
  }

  try {
    if (signal?.aborted) {
      throw createError({ statusCode: 499, statusMessage: 'Job aborted before execution' })
    }

    // Attempt streaming with current access token; if expired (401) and refresh token is available, refresh and retry once
    let result
    try {
      result = await streamEpicGameToCas({
        assetInfo,
        accessToken,
        objectsDir,
        manifestsDir,
        gameTitle,
        appVersion,
        signal,
        onProgress,
      })
    } catch (err: any) {
      if (err?.statusCode === 401 && payload.refreshToken) {
        const refreshed = await refreshEpicToken(payload.refreshToken)
        accessToken = refreshed.access_token
        result = await streamEpicGameToCas({
          assetInfo,
          accessToken,
          objectsDir,
          manifestsDir,
          gameTitle,
          appVersion,
          signal,
          onProgress,
        })
      } else {
        throw err
      }
    }

    const completionData = {
      manifestPath: result.manifestPath,
      totalBytes: totalBytesTransferred,
      fileCount: result.manifest.files.length,
    }

    if (jobStore) {
      await jobStore.setCompleted(jobId, completionData)
    }

    return completionData
  } catch (error: any) {
    if (jobStore) {
      await jobStore.updateStatus(jobId, 'failed', error?.message || 'Ingest failed')
    }
    throw error
  }
}
