import { createError, defineEventHandler, getQuery, getRequestHeader } from 'h3'
import { getUbisoftConfiguration, getUbisoftOwnedTitles } from '../../../../utils/ubisoft/client'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // Ubisoft session tickets travel as `Ubi_v1 t=<ticket>`; accept that or a
  // plain Bearer token, but never log the ticket value.
  const rawAuth = getRequestHeader(event, 'authorization') ?? ''
  const ticket = (rawAuth.startsWith('Ubi_v1 ') ? rawAuth.slice('Ubi_v1 '.length) : rawAuth)
    .replace(/^t=/, '')
    .replace(/^Bearer\s+/i, '')
    .trim()

  if (!ticket) {
    throw createError({ statusCode: 401, statusMessage: 'A Ubisoft Connect session ticket is required' })
  }

  const userId = typeof query.userId === 'string' ? query.userId.trim() : ''
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'A Ubisoft userId query parameter is required' })
  }

  let ownedTitles
  try {
    ownedTitles = await getUbisoftOwnedTitles(ticket, userId)
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage: statusCode === 401 || statusCode === 403
        ? 'Ubisoft Connect rejected the session ticket'
        : 'Unable to retrieve Ubisoft owned titles',
    })
  }

  // Resolve product names for the owned space IDs so the UI can render titles.
  let configurations: { spaceId: string; gameId?: string; name?: string }[] = []
  const spaceIds = ownedTitles.map((t) => t.spaceId)
  if (spaceIds.length > 0) {
    try {
      configurations = await getUbisoftConfiguration(ticket, spaceIds)
    } catch {
      // Name resolution is best-effort; owned titles are still returned.
    }
  }
  const nameBySpace = new Map(configurations.map((c) => [c.spaceId, c]))

  const title = typeof query.title === 'string' ? query.title.trim().toLocaleLowerCase() : ''
  const games = ownedTitles
    .map((t) => ({
      spaceId: t.spaceId,
      gameId: nameBySpace.get(t.spaceId)?.gameId,
      name: nameBySpace.get(t.spaceId)?.name ?? '',
      ownedDate: t.ownedDate,
    }))
    .filter((g) => !title || (g.name || g.spaceId).toLocaleLowerCase().includes(title))

  return { games, total: games.length }
})
