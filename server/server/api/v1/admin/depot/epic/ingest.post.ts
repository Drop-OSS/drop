import { defineEventHandler, readBody } from 'h3';
import { requireAdminUser } from '../../../../internal/authorization';
import { prisma } from '../../../../internal/database';
import { StoreProvider } from '@prisma/client';
import { ingestEpicJob } from '../../../../tasks/epic/ingest';

export default defineEventHandler(async (event) => {
    await requireAdminUser(event);

    const body = await readBody(event);
    const { appName, namespace, catalogItemId } = body;

    if (!appName || !namespace) {
        return {
            error: 'Missing required parameters: "appName" and "namespace" are required.',
            status: 400,
        };
    }

    // Retrieve active Epic store connection from database
    const connection = await prisma.storeConnection.findUnique({
        where: {
            provider: StoreProvider.EPIC,
        },
    });

    if (!connection) {
        return {
            error: 'No active Epic Games store connection found. Please connect your account first.',
            status: 401,
        };
    }

    const jobId = `epic-ingest-${appName}-${Date.now()}`;

    // Dispatches ingestion asynchronously via the task runner
    ingestEpicJob({
        jobId,
        appName,
        namespace,
        catalogItemId,
        connectionId: connection.id,
    }).catch((err) => {
        console.error(`[Epic Ingest] Job ${jobId} failed:`, err);
    });

    return {
        success: true,
        jobId,
        message: `Epic ingestion started for ${appName}`,
    };
});
