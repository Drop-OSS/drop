import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ingestEpicJob, type EpicIngestJobPayload, type IngestJobStore } from './ingest'
import type { EpicAssetManifestInfo } from '../../utils/epic/manifest'

describe('Epic Ingest Task Worker (ingestEpicJob)', () => {
  const dummyAssetInfo: EpicAssetManifestInfo = {
    appName: 'TestGame',
    catalogItemId: 'cat-item-1',
    namespace: 'test-ns',
    buildVersion: '1.0.0',
    distributionPoint: 'https://cdn.epicgames.com/test',
    manifestHash: 'hash123',
    manifestUrl: 'https://cdn.epicgames.com/test/manifest.bin',
  }

  const basePayload: EpicIngestJobPayload = {
    jobId: 'job-1234',
    accountId: 'acc-5678',
    assetInfo: dummyAssetInfo,
    accessToken: 'valid-token',
    gameTitle: 'Satisfactory',
    appVersion: '1.0.0',
  }

  let statusUpdates: Array<{ jobId: string; status: string; error?: string }> = []
  let progressUpdates: Array<{ jobId: string; transferredBytes: number; totalBytes: number }> = []
  let completedData: any = null

  const mockJobStore: IngestJobStore = {
    async updateStatus(jobId, status, error) {
      statusUpdates.push({ jobId, status, error })
    },
    async updateProgress(jobId, progress) {
      progressUpdates.push({ jobId, transferredBytes: progress.transferredBytes, totalBytes: progress.totalBytes })
    },
    async setCompleted(jobId, result) {
      completedData = { jobId, ...result }
    },
  }

  beforeEach(() => {
    statusUpdates = []
    progressUpdates = []
    completedData = null
  })

  it('rejects immediately and updates jobStore status to failed when signal is pre-aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await assert.rejects(
      async () => {
        await ingestEpicJob(basePayload, mockJobStore, controller.signal)
      },
      (err: any) => {
        return err.statusCode === 499 || err.statusMessage?.includes('aborted')
      }
    )

    assert.ok(statusUpdates.some((s) => s.status === 'downloading'))
    assert.ok(statusUpdates.some((s) => s.status === 'failed'))
    assert.strictEqual(completedData, null)
  })

  it('records failure in jobStore and throws when downstream network or CDN stream fails', async () => {
    const payload: EpicIngestJobPayload = {
      ...basePayload,
      jobId: 'job-err',
      assetInfo: {
        ...dummyAssetInfo,
        manifestUrl: 'https://invalid-non-existent-subdomain.epicgames.com/manifest.bin',
      },
    }

    await assert.rejects(
      async () => {
        await ingestEpicJob(payload, mockJobStore)
      },
      /Failed to fetch Epic binary manifest|fetch failed|ENOTFOUND|getaddrinfo/i
    )

    assert.ok(statusUpdates.some((s) => s.jobId === 'job-err' && s.status === 'failed'))
  })
})
