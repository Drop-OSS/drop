import { createError, defineEventHandler, readBody } from "h3";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { isValidGogGameId } from "../../../../utils/gog";

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

/** Depot CAS root: mirrors the Drop data folder the server already owns. */
function depotRoot(): string {
  return join(
    process.env.GAMEDEPOT_DATA_DIR ?? process.env.DATA ?? "./.data/data",
    "depot",
  );
}

export default defineEventHandler(async (event) => {
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

async function queueLocalGogIngest(
  productId: string,
  gameTitle: string | undefined,
  os: string | undefined,
) {
  // Lazy imports keep the prisma/task machinery out of cold routes and
  // out of hermetic tests of the dispatch path.
  const [
    { prismaConnectionStore, markStoreManifestImported },
    { resolveDepotToken },
  ] = await Promise.all([
    import("../../../../utils/depot/connection-store"),
    import("../../../../utils/depot/connections"),
  ]);
  const resolved = await resolveDepotToken(prismaConnectionStore, "gog");
  const root = depotRoot();

  const { taskHandler } = await import("~/server/internal/tasks");
  const { streamGogGameToDepot } =
    await import("../../../../utils/gog/game-streamer");

  let taskId: string;
  try {
    taskId = await taskHandler.create({
      key: `depot:gog:${productId}`,
      taskGroup: "depot:ingest",
      acls: ["system:import:game:read"],
      name: `Ingesting GOG game ${gameTitle ?? productId}`,
      async run({ progress, logger }) {
        logger.info(
          `Acquiring GOG product ${productId} from the stored GOG connection into ${root}`,
        );
        let lastPhase = "";
        const manifestPath = await streamGogGameToDepot({
          jobId: randomUUID(),
          productId,
          gameTitle,
          accessToken: resolved.token,
          depotRoot: root,
          ...(os ? { os } : {}),
          onProgress: (update) => {
            progress(update.progress);
            if (update.phase !== lastPhase) {
              lastPhase = update.phase;
              logger.info(
                `Phase: ${update.phase}${update.currentItem ? ` (${update.currentItem})` : ""}`,
              );
            }
          },
        });
        // The published manifest is named after its digest - that digest is
        // what `localContentId` refers to.
        const digest = basename(manifestPath, ".json");
        logger.info(`Published depot release ${digest}`);
        if (resolved.connectionId) {
          try {
            await markStoreManifestImported(
              resolved.connectionId,
              productId,
              digest,
              gameTitle,
            );
          } catch (error) {
            // The bytes are published; only the library cache line failed.
            logger.warn(
              `Could not record the import in the library cache: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|concurrent/i.test(message)) {
      throw createError({
        statusCode: 409,
        statusMessage:
          "A depot acquisition is already running for this game. Wait for it to finish (task panel).",
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Unable to queue the acquisition: ${message}`,
    });
  }

  return { accepted: true, jobId: taskId, taskId, queued: "local-task" };
}
