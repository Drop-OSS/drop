import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ingestUbisoftJob, type IngestJobStore } from './ingest'

/**
 * Hermetic worker tests using Node's native test runner. The global fetch is
 * stubbed to route Ubisoft service URLs; no network access occurs.
 */

type RecordedState = {
  statuses: string[]
  errors: string[]
  progress: { transferredBytes: number; totalBytes: number; currentFile: string }[]
}

function makeJobStore(): { store: IngestJobStore; state: RecordedState } {
  const state: RecordedState = { statuses: [], errors: [], progress: [] }
  const store: IngestJobStore = {
    updateStatus: async (jobId, status, error) => {
      assert.ok(jobId)
      state.statuses.push(status)
      if (error) state.errors.push(error)
    },
    updateProgress: async (jobId, progress) => {
      assert.ok(jobId)
      state.progress.push(progress)
    },
    setCompleted: async () => {
      state.statuses.push('setCompleted')
    },
  }
  return { store, state }
}

const originalFetch = globalThis.fetch

type FetchHandler = (url: string, init?: RequestInit) => Response

function stubFetch(handler: FetchHandler) {
  globalThis.fetch = ((input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input)
    return Promise.resolve(handler(url, init))
  }) as typeof fetch
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'job-123',
    ticket: 'test-ticket',
    userId: 'user-abc',
    spaceId: 'space-1',
    gameTitle: 'Test Game',
    ...overrides,
  }
}

beforeEach(() => {
  // default: everything 404; individual tests install their own routes
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('rejects when the account does not own the title', async () => {
  stubFetch((url) => {
    if (url.includes('/ownedtitles')) {
      return jsonResponse([{ spaceId: 'space-other' }])
    }
    return jsonResponse({}, 500)
  })

  const { store, state } = makeJobStore()
  await assert.rejects(
    ingestUbisoftJob(basePayload(), store),
    (err: any) => err?.statusCode === 403,
  )
  assert.ok(state.statuses.includes('failed'))
  // No download phase may begin before ownership is confirmed.
  assert.ok(!state.statuses.includes('downloading'))
})

test('rejects when aborted before execution', async () => {
  const controller = new AbortController()
  controller.abort()

  const { store, state } = makeJobStore()
  await assert.rejects(
    ingestUbisoftJob(basePayload(), store, controller.signal),
    (err: any) => err?.statusCode === 499,
  )
  assert.ok(state.statuses.includes('failed'))
})

test('fails closed when no install manifest resolves', async () => {
  stubFetch((url) => {
    if (url.includes('/ownedtitles')) {
      return jsonResponse([{ spaceId: 'space-1' }])
    }
    if (url.includes('/v1/manifests/')) {
      return jsonResponse({}, 404)
    }
    return jsonResponse({}, 500)
  })

  const { store, state } = makeJobStore()
  await assert.rejects(
    ingestUbisoftJob(basePayload(), store),
    (err: any) => err?.statusCode === 404,
  )
  assert.ok(state.statuses.includes('failed'))
})

test('fails closed when the manifest contains no files', async () => {
  stubFetch((url) => {
    if (url.includes('/ownedtitles')) {
      return jsonResponse([{ spaceId: 'space-1' }])
    }
    if (url.includes('/v1/manifests/') && url.includes('/branches/')) {
      return jsonResponse({ manifestId: 'manifest-1', version: 'NEXT' })
    }
    if (url.includes('/files')) {
      return jsonResponse([])
    }
    return jsonResponse({}, 500)
  })

  const { store, state } = makeJobStore()
  await assert.rejects(
    ingestUbisoftJob(basePayload(), store),
    (err: any) => err?.statusCode === 404,
  )
  assert.ok(state.statuses.includes('failed'))
})

test('refreshes the session once on 401 during acquisition', async () => {
  let refreshes = 0
  let manifestCalls = 0

  stubFetch((url) => {
    if (url.includes('/profiles/sessions')) {
      refreshes += 1
      return jsonResponse({ ticket: 'ticket-2', userId: 'user-abc', sessionId: 's1', expiration: 'later' })
    }
    if (url.includes('/ownedtitles')) {
      return jsonResponse([{ spaceId: 'space-1' }])
    }
    if (url.includes('/v1/manifests/') && url.includes('/branches/')) {
      manifestCalls += 1
      // First attempt with the stale ticket fails; the refreshed ticket succeeds.
      return manifestCalls === 1 ? jsonResponse({}, 401) : jsonResponse({ manifestId: 'manifest-1', version: 'NEXT' })
    }
    if (url.includes('/files')) {
      // Empty file list keeps this test off the streaming path.
      return jsonResponse([])
    }
    return jsonResponse({}, 500)
  })

  const { store } = makeJobStore()
  await assert.rejects(
    ingestUbisoftJob(basePayload(), store),
    (err: any) => err?.statusCode === 404,
  )
  assert.equal(refreshes, 1, 'session should be refreshed exactly once')
  assert.ok(manifestCalls >= 2, 'acquisition should be retried with the refreshed ticket')
})
