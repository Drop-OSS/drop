import { createError, defineEventHandler, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import { randomUUID } from "node:crypto";
import { isValidGogGameId } from "../../../../utils/gog";
import { queueLocalGogIngest } from "../../../../utils/depot/ingest-queue";

type IngestBody = {
  gameId?: string | number;
  /** Product title as shown in the library; recorded with the release. */
  gameTitle?: string;
  installer?: {
    os?: string;
    language?: string;
    version?: string;
    platform?: string;
  };
};

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const body = await readBody<IngestBody>(event);
  if (!body || !isValidGogGameId(body.gameId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "A valid GOG game ID is required",
    });
  }
  if (
    body.gameTitle !== undefined &&
    (typeof body.gameTitle !== "string" || body.gameTitle.length > 200)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "gameTitle must be a string of at most 200 characters",
    });
  }
  if (
    body.installer !== undefined &&
    (!body.installer ||
      typeof body.installer !== "object" ||
      Array.isArray(body.installer))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "installer must be an object",
    });
  }
  const installer = body.installer ?? {};
  for (const [key, value] of Object.entries(installer)) {
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length > 128)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `installer.${key} must be a string of at most 128 characters`,
      });
    }
  }

  const config = useRuntimeConfig(event);
  const target =
    (config as typeof config & { gogIngestUrl?: string }).gogIngestUrl ??
    process.env.GAMEDEPOT_INGEST_URL;

  if (!target) {
    // No external pipeline: run the acquisition here as a real, persisted
    // TaskHandler task using the server-side stored connection. The task
    // row is the job record - progress, log and failure state are visible
    // through the existing task websocket like any other Drop task.
    return await queueLocalGogIngest(
      String(body.gameId),
      body.gameTitle,
      installer.os,
    );
  }

  let dispatchUrl: URL;
  try {
    dispatchUrl = new URL(target);
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Configured ingestion dispatch URL is invalid",
    });
  }
  if (
    dispatchUrl.protocol !== "https:" &&
    dispatchUrl.hostname !== "localhost" &&
    dispatchUrl.hostname !== "127.0.0.1"
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: "Ingestion dispatch URL must use HTTPS",
    });
  }

  const job = {
    id: randomUUID(),
    provider: "GOG",
    gameId: String(body.gameId),
    installer: {
      ...(installer.os ? { os: installer.os } : {}),
      ...(installer.language ? { language: installer.language } : {}),
      ...(installer.version ? { version: installer.version } : {}),
      ...(installer.platform ? { platform: installer.platform } : {}),
    },
  };
  try {
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.GAMEDEPOT_INGEST_TOKEN
          ? { authorization: `Bearer ${process.env.GAMEDEPOT_INGEST_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(job),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `Ingestion pipeline rejected the job (${response.status})`,
      });
    }
    const result = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return {
      accepted: true,
      jobId: typeof result.jobId === "string" ? result.jobId : job.id,
    };
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw createError({
      statusCode: 502,
      statusMessage: "Unable to dispatch the ingestion job",
    });
  }
});
