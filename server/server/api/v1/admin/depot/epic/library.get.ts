import { defineEventHandler, getQuery } from 'h3';
import { requireAdminUser } from '../../../../internal/authorization';
import { prisma } from '../../../../internal/database';
import { StoreProvider } from '@prisma/client';
import { fetchEpicEntitlements, refreshEpicToken } from '../../../../utils/epic/client';

export default defineEventHandler(async (event) => {
    await requireAdminUser(event);

    const query = getQuery(event);
    const titleFilter = typeof query.title === 'string' ? query.title : undefined;

    // Retrieve active Epic store connection from database
    const connection = await prisma.storeConnection.findUnique({
        where: {
            provider: StoreProvider.EPIC,
        },
    });

    if (!connection) {
        return {
            error: 'No Epic Games account connected. Please authenticate first.',
            connected: false,
            items: [],
        };
    }

    let accessToken = connection.accessToken;

    // Auto-refresh token if expired or close to expiry (within 5 minutes)
    const isExpired = connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (isExpired && connection.refreshToken) {
        try {
            const refreshed = await refreshEpicToken(connection.refreshToken);
            accessToken = refreshed.access_token;

            await prisma.storeConnection.update({
                where: { provider: StoreProvider.EPIC },
                data: {
                    accessToken: refreshed.access_token,
                    refreshToken: refreshed.refresh_token,
                    tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
                },
            });
        } catch (err: any) {
            return {
                error: `Failed to refresh Epic Games token: ${err.message}`,
                connected: false,
                items: [],
            };
        }
    }

    try {
        const items = await fetchEpicEntitlements(accessToken);

        const filtered = titleFilter
            ? items.filter((item) =>
                item.entitlementName?.toLowerCase().includes(titleFilter.toLowerCase())
            )
            : items;

        return {
            connected: true,
            accountEmail: connection.accountEmail,
            count: filtered.length,
            items: filtered,
        };
    } catch (err: any) {
        return {
            error: `Failed to fetch Epic library: ${err.message}`,
            connected: true,
            items: [],
        };
    }
});
