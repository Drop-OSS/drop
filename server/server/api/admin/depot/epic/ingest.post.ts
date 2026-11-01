import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'

type IngestEpicBody = {
  namespace?: string
  catalogItemId?: string
  appName?: string
  asset?: {
    platform?: string
    label?: string
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<IngestEpicBody>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  const namespace = typeof body.namespace === 'string' ? body.namespace.trim() : ''
  const catalogItemId = typeof body.catalogItemId === 'string' ? body.catalogItemId.trim() : ''
  const appName = typeof body.appName === 'string' ? body.appName.trim() : ''

  if (!namespace || !catalogItemId || !appName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'namespace, catalogItemId, and appName are all required for Epic ingestion',
    })
  }

  const config = useRuntimeConfig(event)
  const target = (config as typeof config & { epicIngestUrl?: string }).epicIngestUrl
    ?? process.env.GAMEDEPOT_EPIC_INGEST_URL
    ?? process.env.GAMEDEPOT_INGEST_URL

  if (!target) {
    throw createError({ statusCode: 503, statusMessage: 'Epic Games ingestion dispatch is not configured' })
  }

  let dispatchUrl: URL
  try {
    dispatchUrl = new URL(target)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Configured Epic ingestion dispatch URL is invalid' })
  }

  if (dispatchUrl.protocol !== 'https:' && dispatchUrl.hostname !== 'localhost' && dispatchUrl.hostname !== '127.0.0.1') {
    throw createError({ statusCode: 500, statusMessage: 'Epic ingestion dispatch URL must use HTTPS' })
  }

  const job = {
    id: randomUUID(),
    provider: 'EPIC',
    namespace,
    catalogItemId,
    appName,
    asset: {
      platform: body.asset?.platform ?? 'Windows',
      label: body.asset?.label ?? 'Live',
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
      throw createError({ statusCode: 502, statusMessage: `Ingestion pipeline rejected the Epic job (${response.status})` })
    }

    const result = await response.json().catch(() => ({})) as Record<string, unknown>
    return { accepted: true, jobId: typeof result.jobId === 'string' ? result.jobId : job.id }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: 'Unable to dispatch Epic Games ingestion job' })
  }
})
