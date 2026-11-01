import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'
import { isValidGogGameId } from '../../../../utils/gog'

type IngestBody = {
  gameId?: string | number
  installer?: {
    os?: string
    language?: string
    version?: string
    platform?: string
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<IngestBody>(event)
  if (!body || !isValidGogGameId(body.gameId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid GOG game ID is required' })
  }
  if (body.installer !== undefined && (!body.installer || typeof body.installer !== 'object' || Array.isArray(body.installer))) {
    throw createError({ statusCode: 400, statusMessage: 'installer must be an object' })
  }
  const installer = body.installer ?? {}
  for (const [key, value] of Object.entries(installer)) {
    if (value !== undefined && (typeof value !== 'string' || value.length > 128)) {
      throw createError({ statusCode: 400, statusMessage: `installer.${key} must be a string of at most 128 characters` })
    }
  }

  const config = useRuntimeConfig(event)
  const target = (config as typeof config & { gogIngestUrl?: string }).gogIngestUrl
    ?? process.env.GAMEDEPOT_INGEST_URL
  if (!target) {
    throw createError({ statusCode: 503, statusMessage: 'GOG ingestion dispatch is not configured' })
  }
  let dispatchUrl: URL
  try {
    dispatchUrl = new URL(target)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Configured ingestion dispatch URL is invalid' })
  }
  if (dispatchUrl.protocol !== 'https:' && dispatchUrl.hostname !== 'localhost' && dispatchUrl.hostname !== '127.0.0.1') {
    throw createError({ statusCode: 500, statusMessage: 'Ingestion dispatch URL must use HTTPS' })
  }

  const job = {
    id: randomUUID(),
    provider: 'GOG',
    gameId: String(body.gameId),
    installer: {
      ...(installer.os ? { os: installer.os } : {}),
      ...(installer.language ? { language: installer.language } : {}),
      ...(installer.version ? { version: installer.version } : {}),
      ...(installer.platform ? { platform: installer.platform } : {}),
    },
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
      throw createError({ statusCode: 502, statusMessage: `Ingestion pipeline rejected the job (${response.status})` })
    }
    const result = await response.json().catch(() => ({})) as Record<string, unknown>
    return { accepted: true, jobId: typeof result.jobId === 'string' ? result.jobId : job.id }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: 'Unable to dispatch the ingestion job' })
  }
})
