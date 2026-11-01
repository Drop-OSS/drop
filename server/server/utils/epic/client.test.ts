import test from 'node:test'
import assert from 'node:assert/strict'
import {
  exchangeEpicAuthCode,
  refreshEpicToken,
  getEpicEntitlements,
  getEpicAssetInfo,
} from './client.js'

test('Epic Client Integration & Mock Suite', async (t) => {
  const originalFetch = globalThis.fetch

  t.afterEach(() => {
    globalThis.fetch = originalFetch
  })

  await t.test('exchangeEpicAuthCode: succeeds and returns tokens on valid auth code', async () => {
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /oauth\/token/)
      assert.equal(init?.method, 'POST')
      const headers = init?.headers as Record<string, string>
      assert.ok(headers.Authorization.startsWith('Basic '))
      assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded')

      const body = new URLSearchParams(init?.body as string)
      assert.equal(body.get('grant_type'), 'authorization_code')
      assert.equal(body.get('code'), 'valid-test-code')

      return new Response(
        JSON.stringify({
          access_token: 'mock-access-token-123',
          refresh_token: 'mock-refresh-token-456',
          expires_in: 3600,
          account_id: 'test-epic-account-id',
          token_type: 'bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await exchangeEpicAuthCode('valid-test-code')
    assert.equal(result.access_token, 'mock-access-token-123')
    assert.equal(result.refresh_token, 'mock-refresh-token-456')
    assert.equal(result.account_id, 'test-epic-account-id')
    assert.equal(result.expires_in, 3600)
  })

  await t.test('exchangeEpicAuthCode: throws 400 when code is invalid or expired', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          errorCode: 'errors.com.epicgames.account.oauth.authorization_code_not_found',
          errorMessage: 'Authorization code is invalid or has expired',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await assert.rejects(
      async () => {
        await exchangeEpicAuthCode('invalid-code')
      },
      (err: any) => {
        return err.statusCode === 400
      }
    )
  })

  await t.test('exchangeEpicAuthCode: throws 502 when Epic auth endpoint fails to respond', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network timeout / connection reset')
    }

    await assert.rejects(
      async () => {
        await exchangeEpicAuthCode('any-code')
      },
      (err: any) => {
        return err.statusCode === 502
      }
    )
  })

  await t.test('refreshEpicToken: refreshes expired access token successfully', async () => {
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /oauth\/token/)
      const body = new URLSearchParams(init?.body as string)
      assert.equal(body.get('grant_type'), 'refresh_token')
      assert.equal(body.get('refresh_token'), 'valid-refresh-token')

      return new Response(
        JSON.stringify({
          access_token: 'new-access-token-789',
          refresh_token: 'new-refresh-token-012',
          expires_in: 7200,
          account_id: 'test-epic-account-id',
          token_type: 'bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await refreshEpicToken('valid-refresh-token')
    assert.equal(result.access_token, 'new-access-token-789')
    assert.equal(result.refresh_token, 'new-refresh-token-012')
    assert.equal(result.expires_in, 7200)
  })

  await t.test('getEpicEntitlements: parses paginated library items', async () => {
    const mockEntitlements = [
      {
        id: 'ent-1',
        entitlementName: 'Fortnite',
        namespace: 'fn',
        catalogItemId: 'catalog-item-1',
        grantDate: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'ent-2',
        entitlementName: 'Alan Wake 2',
        namespace: 'aw2',
        catalogItemId: 'catalog-item-2',
        grantDate: '2024-02-01T00:00:00.000Z',
      },
    ]

    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /entitlement\/api\/account\/test-acc\/entitlements/)
      const headers = init?.headers as Record<string, string>
      assert.equal(headers.Authorization, 'Bearer mock-jwt-token')

      return new Response(JSON.stringify(mockEntitlements), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const entitlements = await getEpicEntitlements('test-acc', 'mock-jwt-token')
    assert.equal(entitlements.length, 2)
    assert.equal(entitlements[0].entitlementName, 'Fortnite')
    assert.equal(entitlements[1].entitlementName, 'Alan Wake 2')
  })

  await t.test('getEpicAssetInfo: returns asset details when game build is found', async () => {
    const mockAsset = {
      appName: 'FortniteApp',
      catalogItemId: 'catalog-item-1',
      namespace: 'fn',
      buildVersion: '28.00.0',
      distributionPoint: 'https://cdn.epicgames.com/builds',
      manifestHash: 'sha256-dummy-hash',
    }

    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /launcher\/api\/public\/assets\/v2\/platform\/Windows/)
      assert.match(String(url), /namespace=fn/)
      assert.match(String(url), /catalogItemId=catalog-item-1/)
      assert.match(String(url), /appName=FortniteApp/)
      const headers = init?.headers as Record<string, string>
      assert.equal(headers.Authorization, 'Bearer mock-jwt-token')

      return new Response(JSON.stringify({ elements: [mockAsset] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const asset = await getEpicAssetInfo('Windows', 'fn', 'catalog-item-1', 'FortniteApp', 'mock-jwt-token')
    assert.ok(asset)
    assert.equal(asset.appName, 'FortniteApp')
    assert.equal(asset.buildVersion, '28.00.0')
    assert.equal(asset.distributionPoint, 'https://cdn.epicgames.com/builds')
  })

  await t.test('getEpicAssetInfo: returns null on 404 not found', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ errorCode: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const asset = await getEpicAssetInfo('Windows', 'fn', 'non-existent', 'App', 'mock-jwt-token')
    assert.equal(asset, null)
  })
})
