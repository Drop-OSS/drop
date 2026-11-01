import { defineEventHandler, readBody } from 'h3';
import { requireAdminUser } from '../../../../internal/authorization';
import { prisma } from '../../../../internal/database';
import { StoreProvider } from '@prisma/client';
import { exchangeEpicAuthCode } from '../../../../utils/epic/client';

export default defineEventHandler(async (event) => {
    await requireAdminUser(event);

    const body = await readBody(event);
    const { code } = body;

    if (!code || typeof code !== 'string') {
        return {
            error: 'Missing required field: "code" (authorization code from Epic Games login).',
            status: 400,
        };
    }

    try {
        const tokenResponse = await exchangeEpicAuthCode(code);

        const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

        // Store or update Epic connection in database
        const connection = await prisma.storeConnection.upsert({
            where: {
                provider: StoreProvider.EPIC,
            },
            create: {
                provider: StoreProvider.EPIC,
                accountId: tokenResponse.account_id,
                accountEmail: tokenResponse.account_id,
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
                tokenExpiresAt,
                syncStatus: 'SYNCED',
            },
            update: {
                accountId: tokenResponse.account_id,
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
                tokenExpiresAt,
                syncStatus: 'SYNCED',
            },
        });

        return {
            success: true,
            connected: true,
            provider: StoreProvider.EPIC,
            accountId: connection.accountId,
            expiresAt: connection.tokenExpiresAt,
        };
    } catch (err: any) {
        return {
            error: `Epic Games authentication failed: ${err.message}`,
            status: 500,
        };
    }
});
