import { defineEventHandler, readBody, createError } from 'h3'
import { exchangeEpicAuthCode, refreshEpicToken } from '~/server/utils/epic/client'

interface EpicAuthBody {
  code?: string
  refreshToken?: string
  label?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<EpicAuthBody>(event).catch(() => null)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  let tokens
  if (body.code) {
    tokens = await exchangeEpicAuthCode(body.code)
  } else if (body.refreshToken) {
    tokens = await refreshEpicToken(body.refreshToken)
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Either "code" or "refreshToken" must be provided',
    })
  }

  // Calculate expiration date
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  return {
    success: true,
    connection: {
      provider: 'EPIC',
      accountId: tokens.account_id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAt.toISOString(),
      tokenType: tokens.token_type,
    },
  }
})
