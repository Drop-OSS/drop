import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'

type IngestUbisoftBody = {
  spaceId?: string
  userId?: string
  gameTitle?: string
  appVersion?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<IngestUbisoftBody>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  const spaceId = typeof body.spaceId === 'string' ? body.spaceId.trim() : ''
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const gameTitle = typeof body.gameTitle === 'string' ? body.gameTitle.trim() : ''

  if (!spaceId || !userId || !gameTitle) {
    throw createError({
      statusCode: 400,
      statusMessage: 'spaceId, userId, and gameTitle are all required for Ubisoft ingestion',
    })
  }

  const config = useRuntimeConfig(event)
  const target = (config as typeof config & { ubisoftIngestUrl?: string }).ubisoftIngestUrl
    ?? process.env.GAMEDEPOT_UBISOFT_INGEST_URL
    ?? process.env.GAMEDEPOT_INGEST_URL

  if (!target) {
    throw createError({ statusCode: 503, statusMessage: 'Ubisoft Connect ingestion dispatch is not configured' })
  }

  let dispatchUrl: URL
  try {
    dispatchUrl = new URL(target)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Configured Ubisoft ingestion dispatch URL is invalid' })
  }

  if (dispatchUrl.protocol !== 'https:' && dispatchUrl.hostname !== 'localhost' && dispatchUrl.hostname !== '127.0.0.1') {
    throw createError({ statusCode: 500, statusMessage: 'Ubisoft ingestion dispatch URL must use HTTPS' })
  }

  // The dispatched job deliberately carries no session ticket or credentials.
  // The ingestion pipeline resolves the account's scoped encrypted ticket from
  // its own credential store when the worker runs; tickets must never travel
  // through request bodies or logs.
  const job = {
    id: randomUUID(),
    provider: 'UBISOFT',
    spaceId,
    userId,
    gameTitle,
    ...(typeof body.appVersion === 'string' && body.appVersion.trim()
      ? { appVersion: body.appVersion.trim() }
      : {}),
  }

  try {
    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.GAMEDEPOT_INGEST_TOKEN
          ? { authorization: `Bearer ${process.env.GAMEDEPOT_INGEST_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(job),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: `Ingestion pipeline rejected the Ubisoft job (${response.status})` })
    }

    const result = await response.json().catch(() => ({})) as Record<string, unknown>
    return { accepted: true, jobId: typeof result.jobId === 'string' ? result.jobId : job.id }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: 'Unable to dispatch Ubisoft Connect ingestion job' })
  }
})
