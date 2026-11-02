import { createError, defineEventHandler, readBody } from "h3";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
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
    { default: prisma },
  ] = await Promise.all([
    import("../../../../utils/depot/connection-store"),
    import("../../../../utils/depot/connections"),
    import("~/server/internal/db/database"),
  ]);
  const resolved = await resolveDepotToken(prismaConnectionStore, "gog");

  // The acquisition lands inside a real Drop library: the Filesystem
  // backend's baseDir is where the game tree is assembled, which is then
  // what torrential's droplet import reads. FlatFilesystem is not a target
  // here; it has no per-game version directories to import.
  const library = await prisma.library.findFirst({
    where: { backend: "Filesystem" },
    orderBy: { id: "asc" },
  });
  const baseDir = (library?.options as { baseDir?: string } | null)?.baseDir;
  if (!library || !baseDir) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Acquisition needs a Filesystem library with a baseDir - add one in the admin panel first.",
    });
  }
  const libraryPath = `gog-${productId}`;
  const gameDir = join(baseDir, libraryPath);

  const { taskHandler, wrapTaskContext } =
    await import("~/server/internal/tasks");
  const { streamGogGameToDepot } =
    await import("../../../../utils/gog/game-streamer");

  let taskId: string;
  try {
    taskId = await taskHandler.create({
      key: `depot:gog:${productId}`,
      taskGroup: "depot:ingest",
      acls: ["system:import:game:read"],
      name: `Ingesting GOG game ${gameTitle ?? productId}`,
      async run(context) {
        const { progress, logger } = context;
        logger.info(
          `Acquiring GOG product ${productId} from the stored GOG connection into ${gameDir}`,
        );
        let lastPhase = "";
        const result = await streamGogGameToDepot({
          productId,
          gameTitle,
          accessToken: resolved.token,
          gameDir,
          ...(os ? { os } : {}),
          onProgress: (update) => {
            // Acquisition covers 0..80; the droplet import owns 80..99.
            progress(Math.min(80, Math.round(update.progress * 0.8)));
            if (update.phase !== lastPhase) {
              lastPhase = update.phase;
              logger.info(
                `Phase: ${update.phase}${update.currentItem ? ` (${update.currentItem})` : ""}`,
              );
            }
          },
        });
        logger.info(
          `Assembled ${result.fileCount} files (${result.totalBytes} bytes) under ${result.versionDir}`,
        );

        // Surface the release as a library game. The row only exists once
        // bytes actually landed, so the library never shows a phantom game.
        const storeManifest = await prisma.storeManifest.findFirst({
          where: { externalGameId: productId },
          orderBy: { updatedAt: "desc" },
        });
        const title = gameTitle ?? storeManifest?.title ?? productId;
        const game = await prisma.game.upsert({
          where: {
            metadataKey: {
              metadataSource: "Manual",
              metadataId: `gog-${productId}`,
            },
          },
          update: { libraryId: library.id, libraryPath, mName: title },
          create: {
            metadataSource: "Manual",
            metadataId: `gog-${productId}`,
            libraryId: library.id,
            libraryPath,
            mName: title,
            mShortDescription: `GOG product ${productId}.`,
            mDescription: `Acquired from GOG (product ${productId}) by the depot pipeline.`,
            mReleased: releaseDateOf(storeManifest?.payload),
            mIconObjectId: "",
            mBannerObjectId: "",
            mCoverObjectId: "",
            mImageLibraryObjectIds: [],
          },
        });

        // Idempotent re-runs: a same-named version already imported stays.
        const existing = await prisma.gameVersion.findFirst({
          where: { gameId: game.id, versionPath: result.versionName },
          select: { versionId: true },
        });
        if (existing) {
          logger.info(
            `Version ${result.versionName} is already imported (${existing.versionId}) - skipping the droplet import`,
          );
        } else {
          const { libraryManager } = await import("~/server/internal/library");
          const { Platform } = await import("~/prisma/client/enums");
          const platform =
            os?.toLowerCase() === "linux"
              ? Platform.Linux
              : os?.toLowerCase() === "macos" || os?.toLowerCase() === "osx"
                ? Platform.macOS
                : Platform.Windows;
          await libraryManager.importVersion(
            game.id,
            {
              type: "local",
              identifier: result.versionName,
              name: result.versionName,
            },
            {
              id: game.id,
              version: {
                type: "local",
                identifier: result.versionName,
                name: result.versionName,
              },
              launches: result.launches.map((launch) => ({
                platform,
                name: launch.name,
                launch: [
                  launch.executable.replace(/\//g, "\\"),
                  ...launch.arguments,
                ].join(" "),
              })),
              setups: [],
              onlySetup: false,
              delta: false,
              requiredContent: [],
            },
            wrapTaskContext(context, {
              min: 80,
              max: 99,
              prefix: "[import] ",
            }),
          );
        }

        progress(99);
        if (resolved.connectionId) {
          try {
            await markStoreManifestImported(
              resolved.connectionId,
              productId,
              `gog-${productId}#${result.versionName}`,
              title,
            );
          } catch (error) {
            // The game is in the library; only the cache line failed.
            logger.warn(
              `Could not record the import in the library cache: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
        logger.info(`${title} is now in the game library.`);
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

/** Best-effort release date from the cached store listing; epoch when unknown. */
function releaseDateOf(payload: unknown): Date {
  const doc = payload as {
    releaseDate?: string;
    releaseGlobal?: { releaseDate?: string };
  } | null;
  const raw = doc?.releaseGlobal?.releaseDate ?? doc?.releaseDate;
  const parsed = raw ? new Date(raw) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0);
}
