import { createError } from 'h3'

const EPIC_OAUTH_TOKEN_URL = 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token'
const EPIC_ENTITLEMENTS_URL = 'https://entitlement-public-service-prod08.ol.epicgames.com/entitlement/api/account'
const EPIC_LAUNCHER_ASSETS_URL = 'https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/v2/platform'

// Basic Epic Games client credentials used by Legendary/Heroic
const EPIC_CLIENT_ID = '34a02cf8f4414e29b15921875d68712d'
const EPIC_CLIENT_SECRET = 'daafbccc737745039d07ba77304609b5'

export type EpicTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  account_id: string
  token_type: string
}

export type EpicEntitlement = {
  id: string
  entitlementName: string
  namespace: string
  catalogItemId: string
  grantDate: string
}

export type EpicAssetInfo = {
  appName: string
  catalogItemId: string
  namespace: string
  buildVersion: string
  distributionPoint: string
  manifestHash?: string
}

/**
 * Exchange an Epic authorization code (obtained from Epic login portal) for access and refresh tokens.
 */
export async function exchangeEpicAuthCode(code: string): Promise<EpicTokenResponse> {
  const credentials = Buffer.from(`${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`).toString('base64')
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
  })

  let response: Response
  try {
    response = await fetch(EPIC_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to contact Epic Games authentication service' })
  }

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: `Epic token exchange failed (${response.status})` })
  }

  return (await response.json()) as EpicTokenResponse
}

/**
 * Refresh an expired Epic access token using a refresh token.
 */
export async function refreshEpicToken(refreshToken: string): Promise<EpicTokenResponse> {
  const credentials = Buffer.from(`${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`).toString('base64')
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  let response: Response
  try {
    response = await fetch(EPIC_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to refresh Epic Games token' })
  }

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: `Epic token refresh failed (${response.status})` })
  }

  return (await response.json()) as EpicTokenResponse
}

/**
 * Fetch all entitled games and apps for an Epic user.
 */
export async function getEpicEntitlements(accountId: string, accessToken: string): Promise<EpicEntitlement[]> {
  const url = `${EPIC_ENTITLEMENTS_URL}/${encodeURIComponent(accountId)}/entitlements?start=0&count=1000`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch Epic entitlements' })
  }

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: `Epic entitlements request failed (${response.status})` })
  }

  return (await response.json()) as EpicEntitlement[]
}

/**
 * Resolve build manifest information and distribution endpoints for an Epic asset/game.
 */
export async function getEpicAssetInfo(
  platform: string,
  namespace: string,
  catalogItemId: string,
  appName: string,
  accessToken: string,
): Promise<EpicAssetInfo | null> {
  const url = `${EPIC_LAUNCHER_ASSETS_URL}/${encodeURIComponent(platform)}?namespace=${encodeURIComponent(namespace)}&catalogItemId=${encodeURIComponent(catalogItemId)}&appName=${encodeURIComponent(appName)}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Failed to query Epic launcher assets API' })
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: `Epic launcher assets query failed (${response.status})` })
  }

  const data = (await response.json()) as { elements?: EpicAssetInfo[] }
  return data.elements?.[0] ?? null
}
