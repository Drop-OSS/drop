import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'

type IngestEaBody = { gameTitle?: string; appVersion?: string; archiveUrl?: string }

/** Admin dispatch route follows the Ubisoft route's configuration and job-shaping contract. */
export default defineEventHandler(async (event) => {
  const body = await readBody<IngestEaBody>(event)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  const gameTitle = typeof body.gameTitle === 'string' ? body.gameTitle.trim() : ''
  const archiveUrl = typeof body.archiveUrl === 'string' ? body.archiveUrl.trim() : ''
  if (!gameTitle || !archiveUrl) throw createError({ statusCode: 400, statusMessage: 'gameTitle and archiveUrl are required for EA ingestion' })
  let parsed: URL
  try { parsed = new URL(archiveUrl) } catch { throw createError({ statusCode: 400, statusMessage: 'EA archiveUrl must be a valid URL' }) }
  if (parsed.protocol !== 'https:') throw createError({ statusCode: 400, statusMessage: 'EA archiveUrl must use HTTPS' })

  const config = useRuntimeConfig(event)
  const target = (config as typeof config & { eaIngestUrl?: string }).eaIngestUrl
    ?? process.env.GAMEDEPOT_EA_INGEST_URL
    ?? process.env.GAMEDEPOT_INGEST_URL
  if (!target) throw createError({ statusCode: 503, statusMessage: 'EA ingestion dispatch is not configured' })
  let dispatchUrl: URL
  try { dispatchUrl = new URL(target) } catch { throw createError({ statusCode: 500, statusMessage: 'Configured EA ingestion dispatch URL is invalid' }) }
  if (dispatchUrl.protocol !== 'https:' && dispatchUrl.hostname !== 'localhost' && dispatchUrl.hostname !== '127.0.0.1') {
    throw createError({ statusCode: 500, statusMessage: 'EA ingestion dispatch URL must use HTTPS' })
  }

  const job = {
    id: randomUUID(), provider: 'EA', gameTitle, archiveUrl,
    ...(typeof body.appVersion === 'string' && body.appVersion.trim() ? { appVersion: body.appVersion.trim() } : {}),
  }
  try {
    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.GAMEDEPOT_INGEST_TOKEN ? { authorization: `Bearer ${process.env.GAMEDEPOT_INGEST_TOKEN}` } : {}) },
      body: JSON.stringify(job), signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw createError({ statusCode: 502, statusMessage: `Ingestion pipeline rejected the EA job (${response.status})` })
    const result = await response.json().catch(() => ({})) as Record<string, unknown>
    return { accepted: true, jobId: typeof result.jobId === 'string' ? result.jobId : job.id }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: 'Unable to dispatch EA ingestion job' })
  }
})
