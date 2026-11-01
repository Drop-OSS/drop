import { createError } from 'h3'

// UNVERIFIED-LIVE: EA Nucleus OAuth, ecommerce2 entitlement routes, and Juno GraphQL schema
// vary by client; confirm these service details against an active EA account before production.
const NUCLEUS_TOKEN_URL = 'https://accounts.ea.com/connect/token'
const ENTITLEMENTS_URL = 'https://ecommerce2.dm.origin.com/ecommerce2/entitlements'
const JUNO_GRAPHQL_URL = 'https://gateway.ea.com/proxy/identity/pids/me'
export type EaTokenResponse = { access_token: string; refresh_token?: string; expires_in: number; token_type?: string; pid?: { pidId?: string }; [key: string]: unknown }
export type EaEntitlement = { entitlementId?: string; offerId?: string; productId?: string; displayName?: string; grantDate?: string; [key: string]: unknown }
export type EaCatalogProduct = { offerId: string; offerName?: string; masterTitleId?: string; [key: string]: unknown }
function form(fields: Record<string, string>, clientId?: string, clientSecret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  if (clientId && clientSecret) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  return { headers, body: new URLSearchParams(fields).toString() }
}
async function eaFetch(url: string, init: RequestInit, label: string): Promise<Response> {
  let response: Response
  try { response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(15_000) }) }
  catch { throw createError({ statusCode: 502, statusMessage: `Failed to contact EA ${label}` }) }
  if (!response.ok) throw createError({ statusCode: response.status, statusMessage: `EA ${label} request failed (${response.status})` })
  return response
}
function tokenShape(raw: unknown): EaTokenResponse {
  if (!raw || typeof raw !== 'object' || typeof (raw as EaTokenResponse).access_token !== 'string' || typeof (raw as EaTokenResponse).expires_in !== 'number' || !Number.isFinite((raw as EaTokenResponse).expires_in)) {
    throw createError({ statusCode: 502, statusMessage: 'EA returned an invalid OAuth token response' })
  }
  return raw as EaTokenResponse
}
/** Exchange a Nucleus authorization code using deployment-provided OAuth client credentials. */
export async function exchangeEaAuthorizationCode(code: string, redirectUri: string, clientId: string, clientSecret: string): Promise<EaTokenResponse> {
  if (!code.trim() || !clientId || !clientSecret) throw createError({ statusCode: 400, statusMessage: 'EA authorization code and OAuth client configuration are required' })
  const request = form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }, clientId, clientSecret)
  const response = await eaFetch(NUCLEUS_TOKEN_URL, { method: 'POST', headers: request.headers, body: request.body }, 'Nucleus authentication')
  return tokenShape(await response.json())
}
/** Refresh a token; the caller must persist a rotated refresh_token if returned. */
export async function refreshEaToken(refreshToken: string, clientId: string, clientSecret: string): Promise<EaTokenResponse> {
  if (!refreshToken || !clientId || !clientSecret) throw createError({ statusCode: 400, statusMessage: 'EA refresh token and OAuth client configuration are required' })
  const request = form({ grant_type: 'refresh_token', refresh_token: refreshToken }, clientId, clientSecret)
  const response = await eaFetch(NUCLEUS_TOKEN_URL, { method: 'POST', headers: request.headers, body: request.body }, 'Nucleus token refresh')
  return tokenShape(await response.json())
}
/** Return one bounded entitlement page. */
export async function getEaEntitlements(accessToken: string, start = 0, count = 1000): Promise<EaEntitlement[]> {
  if (!accessToken || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(count) || count < 1 || count > 1000) throw createError({ statusCode: 400, statusMessage: 'Invalid EA entitlement query' })
  const url = new URL(ENTITLEMENTS_URL); url.searchParams.set('start', String(start)); url.searchParams.set('count', String(count)); url.searchParams.set('access_token', accessToken)
  const data = await (await eaFetch(url.toString(), { headers: { Accept: 'application/json' } }, 'entitlements')).json() as unknown
  if (Array.isArray(data)) return data as EaEntitlement[]
  if (data && typeof data === 'object' && Array.isArray((data as { entitlements?: unknown }).entitlements)) return (data as { entitlements: EaEntitlement[] }).entitlements
  throw createError({ statusCode: 502, statusMessage: 'EA returned an invalid entitlement list' })
}
/** Search Juno's GraphQL catalog. Operation/fields are provisional pending live verification. */
export async function searchEaCatalog(accessToken: string, searchTerm: string): Promise<EaCatalogProduct[]> {
  if (!accessToken || !searchTerm.trim()) throw createError({ statusCode: 400, statusMessage: 'EA access token and catalog search term are required' })
  // UNVERIFIED-LIVE: Juno GraphQL operation and result shape are modeled on observed catalog conventions.
  const query = 'query SearchOffers($searchTerm: String!) { offers(searchTerm: $searchTerm) { offerId offerName masterTitleId } }'
  const response = await eaFetch(JUNO_GRAPHQL_URL, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { searchTerm } }) }, 'Juno catalog')
  const payload = await response.json() as { data?: { offers?: unknown }; errors?: unknown[] }
  if (payload.errors?.length) throw createError({ statusCode: 502, statusMessage: 'EA Juno catalog query returned GraphQL errors' })
  if (!Array.isArray(payload.data?.offers)) throw createError({ statusCode: 502, statusMessage: 'EA Juno returned an invalid catalog response' })
  return payload.data.offers.filter((item): item is EaCatalogProduct => !!item && typeof item === 'object' && typeof (item as EaCatalogProduct).offerId === 'string')
}
