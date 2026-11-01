import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  createUbisoftSession,
  refreshUbisoftSession,
  getUbisoftOwnedTitles,
} from './client'

// Hermetic tests: no network access. Global fetch is stubbed per test.
const originalFetch = globalThis.fetch
let fetchCalls: { url: string; init: RequestInit }[] = []

function stubFetch(responses: { match: (url: string) => boolean; status: number; body: unknown }[]) {
  globalThis.fetch = (async (url: any, init: any) => {
    fetchCalls.push({ url: String(url), init })
    const responder = responses.find((r) => r.match(String(url)))
    if (!responder) {
      return new Response('{}', { status: 404 })
    }
    return new Response(JSON.stringify(responder.body), {
      status: responder.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
}

const SESSION_URL = 'https://public-ubiservices.ubi.com/v3/profiles/sessions'
const OWNED_URL = 'https://public-ubiservices.ubi.com/v1/profiles/user-1/ownedtitles'

beforeEach(() => {
  fetchCalls = []
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('createUbisoftSession exchanges credentials for a session ticket', async () => {
  stubFetch([
    {
      match: (url) => url === SESSION_URL,
      status: 200,
      body: {
        ticket: 'ubi-ticket',
        sessionId: 'session-1',
        userId: 'user-1',
        username: 'user',
        nameOnPlatform: 'User',
        expiration: '2026-01-01T00:00:00Z',
      },
    },
  ])

  const session = await createUbisoftSession('user@example.com', 'hunter2')

  assert.equal(session.ticket, 'ubi-ticket')
  assert.equal(session.userId, 'user-1')
  assert.equal(session.sessionId, 'session-1')

  const call = fetchCalls[0]
  assert.equal(call.init.method, 'POST')
  const headers = call.init.headers as Record<string, string>
  assert.equal(headers['Ubi-AppId'], '3ad0af50-b1e5-4e5f-8c69-b1b17d3a4e9a')
  // Credentials must travel as Basic auth, never as query params or body text.
  assert.ok(headers['Authorization']?.startsWith('Basic '))
  assert.ok(!call.url.includes('hunter2'))
})

test('refreshUbisoftSession replays the previous ticket', async () => {
  stubFetch([
    {
      match: (url) => url === SESSION_URL,
      status: 200,
      body: {
        ticket: 'ubi-ticket-2',
        sessionId: 'session-2',
        userId: 'user-1',
        username: 'user',
        nameOnPlatform: 'User',
        expiration: '2026-01-02T00:00:00Z',
      },
    },
  ])

  const session = await refreshUbisoftSession('ubi-ticket-1')

  assert.equal(session.ticket, 'ubi-ticket-2')
  const headers = fetchCalls[0].init.headers as Record<string, string>
  assert.equal(headers['Authorization'], 'Ubi_v1 t=ubi-ticket-1')
})

test('getUbisoftOwnedTitles returns owned spaces for the account', async () => {
  stubFetch([
    {
      match: (url) => url === OWNED_URL,
      status: 200,
      body: [{ spaceId: 'space-1' }, { spaceId: 'space-2' }],
    },
  ])

  const titles = await getUbisoftOwnedTitles('ubi-ticket', 'user-1')

  assert.deepEqual(titles, [{ spaceId: 'space-1' }, { spaceId: 'space-2' }])
  const headers = fetchCalls[0].init.headers as Record<string, string>
  assert.equal(headers['Authorization'], 'Ubi_v1 t=ubi-ticket')
})

test('owned titles failure surfaces a typed error, not raw response data', async () => {
  stubFetch([
    {
      match: (url) => url === OWNED_URL,
      status: 401,
      body: { error: 'unauthorized' },
    },
  ])

  await assert.rejects(
    () => getUbisoftOwnedTitles('expired-ticket', 'user-1'),
    (err: any) => err?.statusCode === 401,
  )
})
