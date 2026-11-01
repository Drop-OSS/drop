import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { exchangeEaAuthorizationCode, getEaEntitlements, refreshEaToken, searchEaCatalog } from './client'

const originalFetch = globalThis.fetch
const calls: { url: string; init: RequestInit }[] = []
function mockFetch(status: number, body: unknown) {
  calls.length = 0
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}
afterEach(() => { globalThis.fetch = originalFetch })

test('exchanges EA authorization code with form fields and client auth', async () => {
  mockFetch(200, { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 })
  const token = await exchangeEaAuthorizationCode('code-value', 'https://app.example/callback', 'client', 'secret')
  assert.equal(token.access_token, 'access')
  assert.equal(calls[0].url, 'https://accounts.ea.com/connect/token')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers.Authorization, `Basic ${Buffer.from('client:secret').toString('base64')}`)
  assert.match(String(calls[0].init.body), /grant_type=authorization_code/)
})

test('refreshes EA tokens and accepts rotated refresh token', async () => {
  mockFetch(200, { access_token: 'new-access', refresh_token: 'rotated', expires_in: 1800 })
  const token = await refreshEaToken('old-refresh', 'client', 'secret')
  assert.equal(token.refresh_token, 'rotated')
  assert.match(String(calls[0].init.body), /grant_type=refresh_token/)
})

test('shapes EA entitlement response', async () => {
  mockFetch(200, { entitlements: [{ offerId: 'OFFER-1' }] })
  const result = await getEaEntitlements('bearer', 0, 100)
  assert.deepEqual(result, [{ offerId: 'OFFER-1' }])
  assert.match(calls[0].url, /count=100/)
})

test('shapes Juno GraphQL catalog product list', async () => {
  mockFetch(200, { data: { offers: [{ offerId: 'OFFER-1', offerName: 'Game' }, { invalid: true }] } })
  const products = await searchEaCatalog('bearer', 'sample game')
  assert.deepEqual(products, [{ offerId: 'OFFER-1', offerName: 'Game' }])
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer bearer')
})
