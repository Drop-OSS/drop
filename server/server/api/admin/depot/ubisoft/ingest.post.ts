import { createError, defineEventHandler, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import { join } from "node:path";

type IngestUbisoftBody = {
  /** Demux numeric product id, as listed by the Ubisoft library route. */
  productId?: string | number;
  /** Specific manifest SHA-1; the entitlement's latest when omitted. */
  manifestSha1?: string;
  /** Chunk language selector from the install manifest; default "en-US". */
  language?: string;
  /** Product title as shown in the library; recorded with the release. */
  gameTitle?: string;
};

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const body = await readBody<IngestUbisoftBody>(event);
  const productId =
    typeof body?.productId === "number"
      ? body.productId
      : typeof body?.productId === "string" &&
          /^\d+$/.test(body.productId.trim())
        ? Number(body.productId.trim())
        : NaN;
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "A numeric Ubisoft product id is required",
    });
  }
  const manifestSha1 =
    typeof body?.manifestSha1 === "string" ? body.manifestSha1.trim() : "";
  if (manifestSha1 && !/^[0-9a-fA-F]{40}$/.test(manifestSha1)) {
    throw createError({
      statusCode: 400,
      statusMessage: "manifestSha1 must be a 40-character hex SHA-1",
    });
  }
  const language =
    typeof body?.language === "string" &&
    /^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(body.language.trim())
      ? body.language.trim()
      : undefined;
  if (
    body?.gameTitle !== undefined &&
    (typeof body.gameTitle !== "string" || body.gameTitle.length > 200)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "gameTitle must be a string of at most 200 characters",
    });
  }

  return await queueLocalUbisoftIngest(
    productId,
    manifestSha1 || undefined,
    language,
    body?.gameTitle,
  );
});

async function queueLocalUbisoftIngest(
  productId: number,
  manifestSha1: string | undefined,
  language: string | undefined,
  gameTitle: string | undefined,
) {
  // Lazy imports keep the prisma/task machinery out of cold routes.
  const [
    { prismaConnectionStore, markStoreManifestImported },
    { resolveDepotToken },
    { default: prisma },
  ] = await Promise.all([
    import("../../../../utils/depot/connection-store"),
    import("../../../../utils/depot/connections"),
    import("~/server/internal/db/database"),
  ]);
  const resolved = await resolveDepotToken(prismaConnectionStore, "ubisoft");

  // Same landing contract as the GOG pipeline: the Filesystem backend's
  // baseDir holds the assembled tree, which is what Drop's version import
  // reads back as a library release.
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
  const libraryPath = `ubi-${productId}`;
  const gameDir = join(baseDir, libraryPath);

  const { taskHandler, wrapTaskContext } =
    await import("~/server/internal/tasks");
  const { streamUbisoftGameToDepot } =
    await import("../../../../utils/ubisoft/game-streamer");

  let taskId: string;
  try {
    taskId = await taskHandler.create({
      key: `depot:ubi:${productId}`,
      taskGroup: "depot:ingest",
      acls: ["system:import:game:read"],
      name: `Ingesting Ubisoft game ${gameTitle ?? productId}`,
      async run(context) {
        const { progress, logger } = context;
        logger.info(
          `Acquiring Ubisoft product ${productId} from the stored Ubisoft connection into ${gameDir}`,
        );
        let lastPhase = "";
        const result = await streamUbisoftGameToDepot({
          productId,
          accessToken: resolved.token,
          gameDir,
          ...(manifestSha1 ? { manifestSha1 } : {}),
          ...(language ? { language } : {}),
          onProgress: (update) => {
            // Acquisition covers 0..80; the version import owns 80..99.
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
          where: { externalGameId: String(productId) },
          orderBy: { updatedAt: "desc" },
        });
        const title =
          gameTitle ??
          result.title ??
          storeManifest?.title ??
          `Ubisoft product ${productId}`;
        const game = await prisma.game.upsert({
          where: {
            metadataKey: {
              metadataSource: "Manual",
              metadataId: `ubi-${productId}`,
            },
          },
          update: { libraryId: library.id, libraryPath, mName: title },
          create: {
            metadataSource: "Manual",
            metadataId: `ubi-${productId}`,
            libraryId: library.id,
            libraryPath,
            mName: title,
            mShortDescription: `Ubisoft product ${productId}.`,
            mDescription: `Acquired from Ubisoft Connect (product ${productId}) by the depot pipeline.`,
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
            `Version ${result.versionName} is already imported (${existing.versionId}) - skipping the version import`,
          );
        } else {
          const { libraryManager } = await import("~/server/internal/library");
          const { Platform } = await import("~/prisma/client/enums");
          // Demux ships Windows builds; the executables are install-relative.
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
                platform: Platform.Windows,
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
              String(productId),
              `ubi-${productId}#${result.versionName}`,
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
  const doc = payload as { releaseDate?: string } | null;
  const parsed = doc?.releaseDate ? new Date(doc.releaseDate) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0);
}
