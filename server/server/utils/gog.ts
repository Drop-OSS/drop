import { createError } from 'h3'

const GOG_LIBRARY_URL = 'https://embed.gog.com/user/data/games'

type GogResponse = {
  owned?: unknown[]
  games?: unknown[]
}

export type GogGame = {
  id: string
  title: string
  worksOn?: string[]
  platforms?: string[]
  [key: string]: unknown
}

export function isValidGogGameId(value: unknown): value is string | number {
  return (typeof value === 'string' && /^\d{1,20}$/.test(value))
    || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
}

/** Fetches the authenticated user's owned titles from the GOG Galaxy embed API. */
export async function getGogLibrary(accessToken: string): Promise<GogGame[]> {
  const url = new URL(GOG_LIBRARY_URL)
  url.searchParams.set('access_token', accessToken)
  let response: Response
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'GOG library request failed' })
  }
  if (response.status === 401 || response.status === 403) {
    throw createError({ statusCode: response.status, statusMessage: 'GOG access token is invalid or expired' })
  }
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: `GOG library request failed (${response.status})` })
  }

  let payload: GogResponse
  try {
    payload = await response.json() as GogResponse
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'GOG returned an invalid library response' })
  }
  const records = Array.isArray(payload.owned) ? payload.owned : Array.isArray(payload.games) ? payload.games : []
  return records.flatMap((record): GogGame[] => {
    if (!record || typeof record !== 'object') return []
    const item = record as Record<string, unknown>
    const rawId = item.id ?? item.gameId
    const rawTitle = item.title ?? item.name
    if (!isValidGogGameId(rawId) || typeof rawTitle !== 'string') return []
    const rawPlatforms = item.worksOn ?? item.platforms
    const platforms = Array.isArray(rawPlatforms)
      ? rawPlatforms.filter((platform): platform is string => typeof platform === 'string')
      : undefined
    return [{
      ...item,
      id: String(rawId),
      title: rawTitle,
      ...(platforms ? { worksOn: platforms, platforms } : {}),
    }]
  })
}
