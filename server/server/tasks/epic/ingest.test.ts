import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ingestEpicJob, type EpicIngestJobPayload, type IngestJobStore } from './ingest'
import type { EpicAssetManifestInfo } from '../../utils/epic/manifest'
/** Assert an h3-style typed error: a status code and, optionally, a message fragment. */
function typedError(statusCode: number, message?: RegExp) {
  return (error: unknown): boolean => {
    const thrown = error as { statusCode?: number; statusMessage?: string; message?: string } | null
    const text = thrown?.statusMessage ?? thrown?.message ?? ''
    return thrown?.statusCode === statusCode && (message === undefined || message.test(text))
  }
}

/**
 * Hermetic worker tests: every Epic endpoint is a fetch stub, so no test ever
 * reaches the network or depends on DNS failure.
 */

const dummyAssetInfo: EpicAssetManifestInfo = {
  appName: 'TestGame',
  catalogItemId: 'cat-item-1',
  namespace: 'test-ns',
  buildVersion: '1.0.0',
  distributionPoint: 'https://cdn.epicgames.com/test',
  manifestHash: 'hash123',
  manifestUrl: 'https://manifests.epicgames.com/test/manifest.bin',
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
let completedData: unknown = null

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

const originalFetch = globalThis.fetch

/** Route stubs: first matching pattern wins; unmatched URLs fail the test loudly. */
function stubFetch(routes: Array<{ match: RegExp; respond: (url: string, init?: RequestInit) => Response }>) {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    const route = routes.find((r) => r.match.test(url))
    if (!route) {
      throw new Error(`Unexpected network request in test: ${url}`)
    }
    return route.respond(url, init)
  }) as typeof fetch
}

describe('Epic Ingest Task Worker (ingestEpicJob)', () => {
  let depotDir: string

  beforeEach(async () => {
    statusUpdates = []
    progressUpdates = []
    completedData = null
    // Keep CAS writes out of the repository.
    depotDir = await mkdtemp(join(tmpdir(), 'gamedepot-epic-'))
    process.env.GAMEDEPOT_DATA_DIR = depotDir
  })

  afterEach(async () => {
    globalThis.fetch = originalFetch
    delete process.env.GAMEDEPOT_DATA_DIR
    await rm(depotDir, { recursive: true, force: true })
  })

  it('rejects immediately and updates jobStore status to failed when signal is pre-aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await assert.rejects(
      async () => {
        await ingestEpicJob(basePayload, mockJobStore, controller.signal)
      },
      typedError(499, /aborted/i)
    )

    assert.ok(statusUpdates.some((s) => s.status === 'downloading'))
    assert.ok(statusUpdates.some((s) => s.status === 'failed'))
    assert.strictEqual(completedData, null)
  })

  it('records failure in jobStore and throws when the manifest download fails', async () => {
    stubFetch([{ match: /manifests\.epicgames\.com/, respond: () => new Response('nope', { status: 500 }) }])

    await assert.rejects(
      async () => {
        await ingestEpicJob({ ...basePayload, jobId: 'job-err' }, mockJobStore)
      },
      /Failed to fetch Epic binary manifest \(500\)/
    )

    assert.ok(statusUpdates.some((s) => s.jobId === 'job-err' && s.status === 'failed'))
    assert.strictEqual(completedData, null)
  })

  it('refuses a non-HTTPS manifest URL instead of fetching it', async () => {
    let fetched = false
    stubFetch([
      {
        match: /.*/,
        respond: () => {
          fetched = true
          return new Response('{}', { status: 200 })
        },
      },
    ])

    await assert.rejects(
      () =>
        ingestEpicJob(
          {
            ...basePayload,
            jobId: 'job-http',
            assetInfo: { ...dummyAssetInfo, manifestUrl: 'http://manifests.epicgames.com/manifest.bin' },
          },
          mockJobStore
        ),
      /non-HTTPS/
    )
    assert.equal(fetched, false, 'a rejected URL must never be requested')
  })

  it('refreshes the token once on 401 and retries the stream', async () => {
    let manifestAttempts = 0
    const refreshCalls: string[] = []

    stubFetch([
      {
        match: /manifests\.epicgames\.com/,
        respond: () => {
          manifestAttempts += 1
          return manifestAttempts === 1
            ? new Response('expired', { status: 401 })
            : new Response('still broken', { status: 500 })
        },
      },
      {
        match: /epicgames\.com\/account\/api\/oauth\/token/,
        respond: (url, init) => {
          refreshCalls.push(String(init?.body))
          return new Response(
            JSON.stringify({
              access_token: 'fresh-token',
              refresh_token: 'fresh-refresh',
              expires_in: 7200,
              token_type: 'bearer',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        },
      },
    ])

    await assert.rejects(
      () => ingestEpicJob({ ...basePayload, jobId: 'job-refresh', refreshToken: 'old-refresh' }, mockJobStore),
      /Failed to fetch Epic binary manifest \(500\)/
    )

    assert.equal(manifestAttempts, 2, 'the stream must be retried once after refreshing')
    assert.equal(refreshCalls.length, 1)
    assert.match(refreshCalls[0]!, /grant_type=refresh_token/)
    assert.ok(statusUpdates.some((s) => s.jobId === 'job-refresh' && s.status === 'failed'))
  })

  it('fails closed with a typed 501 while binary manifest decoding is unimplemented', async () => {
    // Epic build manifests use a proprietary binary format. Until the decoder is
    // validated against a real sample, ingestion must stop here rather than
    // publish a manifest built from a guessed file map.
    stubFetch([
      {
        match: /manifests\.epicgames\.com/,
        respond: () => new Response(Buffer.from([0x0c, 0xc0, 0xbe, 0x44, 0x00, 0x01]), { status: 200 }),
      },
    ])

    await assert.rejects(
      () => ingestEpicJob({ ...basePayload, jobId: 'job-parser' }, mockJobStore),
      typedError(501, /not implemented/i)
    )

    assert.ok(statusUpdates.some((s) => s.jobId === 'job-parser' && s.status === 'failed'))
    assert.strictEqual(completedData, null)
  })
})
