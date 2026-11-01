import { createError, defineEventHandler, getQuery, getRequestHeader } from 'h3'
import { getGogLibrary } from '../../../../utils/gog'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = (typeof query.token === 'string' ? query.token : undefined)
    ?? getRequestHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'A GOG access token is required' })
  }

  let games
  try {
    games = await getGogLibrary(token)
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage: statusCode === 401 || statusCode === 403
        ? 'GOG rejected the access token'
        : 'Unable to retrieve the GOG library',
    })
  }

  const title = typeof query.title === 'string' ? query.title.trim().toLocaleLowerCase() : ''
  const os = typeof query.os === 'string' ? query.os.trim().toLocaleLowerCase() : ''
  const filtered = games.filter((game) => {
    const titleMatches = !title || game.title.toLocaleLowerCase().includes(title)
    const supported = game.worksOn ?? game.platforms ?? []
    const osMatches = !os || supported.some((platform) => platform.toLocaleLowerCase().includes(os))
    return titleMatches && osMatches
  })

  return { games: filtered, total: filtered.length }
})
