import { defineEventHandler } from 'h3';
import { requireAdminUser } from '../../../../internal/authorization';
import { prisma } from '../../../../internal/database';
import { StoreProvider } from '@prisma/client';

export default defineEventHandler(async (event) => {
    await requireAdminUser(event);

    const connection = await prisma.storeConnection.findUnique({
        where: {
            provider: StoreProvider.EPIC,
        },
    });

    if (!connection) {
        return {
            connected: false,
            provider: StoreProvider.EPIC,
        };
    }

    return {
        connected: true,
        provider: StoreProvider.EPIC,
        accountId: connection.accountId,
        accountEmail: connection.accountEmail,
        syncStatus: connection.syncStatus,
        lastSyncAt: connection.lastSyncAt,
    };
});
