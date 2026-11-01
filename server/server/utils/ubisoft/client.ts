import { createError } from 'h3'

const UBISOFT_SESSIONS_URL = 'https://public-ubiservices.ubi.com/v3/profiles/sessions'
const UBISOFT_OWNED_TITLES_URL = 'https://public-ubiservices.ubi.com/v1/profiles'
const UBISOFT_CONFIG_URL = 'https://api-uplayv2.ubi.com/v1/configuration'
const UBISOFT_MANIFEST_URL = 'https://api-uplayv2.ubi.com/v1/manifests'
const UBISOFT_DNS_MANIFEST_URL = 'https://uplaypc-dns.ubi.com/v1/manifests'

/**
 * Public Ubisoft Connect PC client application identifier (widely published
 * constant, equivalent in role to the Epic client credentials).
 */
const UBISOFT_APP_ID = '3ad0af50-b1e5-4e5f-8c69-b1b17d3a4e9a'

const DEFAULT_BRANCH = 'master'
const DEFAULT_VERSION = 'NEXT'

export type UbisoftSession = {
  ticket: string
  sessionId: string
  userId: string
  username: string
  nameOnPlatform: string
  expiration: string
  platformType?: string
}

export type UbisoftOwnedTitle = {
  spaceId: string
  ownedDate?: string
}

export type UbisoftConfiguration = {
  spaceId: string
  gameId?: string
  name?: string
}

export type UbisoftManifestInfo = {
  manifestId: string
  version: string
  gameId?: string
}

export type UbisoftFileRecord = {
  fileId: string
  path?: string
  size?: number
  source: string
}

function ubiHeaders(ticket?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Ubi-AppId': UBISOFT_APP_ID,
    'Ubi-RequestedPlatformType': 'uplaypc',
    'Content-Type': 'application/json',
  }
  if (ticket) {
    // Ubisoft session tickets travel as `Ubi_v1 t=<ticket>`; never log them.
    headers['Authorization'] = `Ubi_v1 t=${ticket}`
  }
  return headers
}

async function ubiFetch(url: string, init: RequestInit, failureMessage: string): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(15_000) })
  } catch {
    throw createError({ statusCode: 502, statusMessage: failureMessage })
  }
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `${failureMessage} (${response.status})`,
    })
  }
  return response
}

/**
 * Create a Ubisoft Connect session from account credentials.
 * Equivalent to `authorize` in the shared adapter contract.
 */
export async function createUbisoftSession(email: string, password: string): Promise<UbisoftSession> {
  const basic = Buffer.from(`${email}:${password}`).toString('base64')
  const response = await ubiFetch(
    UBISOFT_SESSIONS_URL,
    {
      method: 'POST',
      headers: {
        ...ubiHeaders(),
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rememberMe: true }),
    },
    'Failed to contact Ubisoft Connect authentication service',
  )

  const data = (await response.json()) as UbisoftSession
  return data
}

/**
 * Refresh a session by replaying a valid ticket. Ubisoft rotates sessions by
 * presenting the previous ticket; a new session/ticket pair is returned.
 */
export async function refreshUbisoftSession(ticket: string): Promise<UbisoftSession> {
  const response = await ubiFetch(
    UBISOFT_SESSIONS_URL,
    {
      method: 'POST',
      headers: { ...ubiHeaders(ticket) },
    },
    'Failed to refresh Ubisoft Connect session',
  )
  return (await response.json()) as UbisoftSession
}

/**
 * List titles owned by the account (`discover`). Only owned spaces may be
 * ingested; ownership is the adapter's authorization boundary.
 */
export async function getUbisoftOwnedTitles(
  ticket: string,
  userId: string
): Promise<UbisoftOwnedTitle[]> {
  const url = `${UBISOFT_OWNED_TITLES_URL}/${encodeURIComponent(userId)}/ownedtitles`
  const response = await ubiFetch(
    url,
    { method: 'GET', headers: ubiHeaders(ticket) },
    'Failed to fetch Ubisoft owned titles',
  )
  return ((await response.json()) as UbisoftOwnedTitle[]) ?? []
}

/**
 * Resolve product configuration for one or more space IDs (`normalize`):
 * maps an owned space ID to the internal Ubisoft game/app ID used by the
 * configuration and manifest services.
 */
export async function getUbisoftConfiguration(
  ticket: string,
  spaceIds: string[]
): Promise<UbisoftConfiguration[]> {
  if (spaceIds.length === 0) return []
  const query = encodeURIComponent(JSON.stringify(spaceIds))
  const response = await ubiFetch(
    `${UBISOFT_CONFIG_URL}?applications=${query}`,
    { method: 'GET', headers: ubiHeaders(ticket) },
    'Failed to fetch Ubisoft product configuration',
  )
  return ((await response.json()) as UbisoftConfiguration[]) ?? []
}

/**
 * Resolve the installable manifest for an Ubisoft application.
 * Adapters must only stage content for products the account is
 * entitled to (verified via owned titles before calling this).
 */
export async function resolveUbisoftManifest(
  ticket: string,
  appId: string,
  version: string = DEFAULT_VERSION,
  branch: string = DEFAULT_BRANCH
): Promise<UbisoftManifestInfo | null> {
  const url = `${UBISOFT_MANIFEST_URL}/${encodeURIComponent(version)}/${encodeURIComponent(appId)}/branches/${encodeURIComponent(branch)}`
  const response = await ubiFetch(
    url,
    { method: 'GET', headers: ubiHeaders(ticket) },
    'Failed to resolve Ubisoft install manifest',
  )
  const data = (await response.json()) as UbisoftManifestInfo
  if (!data?.manifestId) return null
  return data
}

/**
 * Fetch the file manifest for a resolved install manifest. Returns file
 * records with per-file download sources. This is the `acquire` planning
 * step; adapter output (paths, sizes, sources) is treated as untrusted and
 * must be re-validated during streaming.
 */
export async function fetchUbisoftFileRecords(
  ticket: string,
  manifestId: string,
  signal?: AbortSignal
): Promise<UbisoftFileRecord[]> {
  const records: UbisoftFileRecord[] = []
  const limit = 50
  let start = 0

  // The file service is paginated; keep requests bounded and cancellable.
  while (true) {
    if (signal?.aborted) {
      throw createError({ statusCode: 499, statusMessage: 'Ubisoft file manifest fetch aborted' })
    }

    const response = await ubiFetch(
      `${UBISOFT_DNS_MANIFEST_URL}/${encodeURIComponent(manifestId)}/files?limit=${limit}&start=${start}`,
      {
        method: 'POST',
        headers: ubiHeaders(ticket),
        body: JSON.stringify({ patch: false, fallback: 'readable' }),
        signal,
      },
      'Failed to fetch Ubisoft file manifest',
    )

    const batch = (await response.json()) as UbisoftFileRecord[]
    if (!Array.isArray(batch) || batch.length === 0) break
    records.push(...batch)
    if (batch.length < limit) break
    start += batch.length
  }

  return records
}
