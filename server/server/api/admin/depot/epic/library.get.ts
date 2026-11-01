import { createError, defineEventHandler, getQuery, getRequestHeader } from 'h3'
import { getEpicEntitlements } from '../../../../utils/epic/client'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = (typeof query.token === 'string' ? query.token : undefined)
    ?? getRequestHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'An Epic Games access token is required' })
  }

  let entitlements
  try {
    entitlements = await getEpicEntitlements(token)
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    throw createError({
      statusCode: statusCode === 401 || statusCode === 403 ? statusCode : 502,
      statusMessage: statusCode === 401 || statusCode === 403
        ? 'Epic Games rejected the access token'
        : 'Unable to retrieve Epic Games entitlements',
    })
  }

  const title = typeof query.title === 'string' ? query.title.trim().toLocaleLowerCase() : ''
  const filtered = entitlements.filter((item) => {
    const titleMatches = !title || item.title.toLocaleLowerCase().includes(title)
    return titleMatches
  })

  return { games: filtered, total: filtered.length }
})
