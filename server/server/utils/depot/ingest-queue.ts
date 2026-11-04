/**
 * Local acquisition queueing, shared by the ingest endpoints and the update
 * checker. The two used to be the ingest routes' private helpers; a node
 * that decides on its own "this game has a newer build" must queue work
 * through exactly the same task pipeline an admin press does - same task
 * keys (so concurrent duplicates are refused), same landing contract
 * (Filesystem library -> version dir -> droplet import), same cache line.
 * Bodies were moved verbatim from the two ingest routes; only the lazy
 * import paths changed with the files' new depth.
 */
import { createError } from "h3";
import { join } from "node:path";

export async function queueLocalGogIngest(
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
    import("./connection-store"),
    import("./connections"),
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
  const { streamGogGameToDepot } = await import("../gog/game-streamer");

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

        // Real product copy and release date (best-effort): the keyless
        // catalogue API carries both. On failure the exact placeholder strings
        // remain and the cached listing decides the date, and the admin
        // refresh treats the placeholders and an epoch date as empty, so a
        // later refresh backfills without a re-ingest.
        let shortDescription = `GOG product ${productId}.`;
        let description = `Acquired from GOG (product ${productId}) by the depot pipeline.`;
        let released: Date | undefined;
        try {
          const { fetchGogProductInfo, parseGogReleaseDate } =
            await import("./provider-info");
          const info = await fetchGogProductInfo(productId);
          if (info?.shortDescription) shortDescription = info.shortDescription;
          if (info?.description) description = info.description;
          released = info ? parseGogReleaseDate(info.releaseDate) : undefined;
          logger.info(
            info?.description
              ? "Attached GOG product description."
              : "GOG product info unavailable; placeholders kept.",
          );
          if (released)
            logger.info(
              `Release date from the catalogue: ${released.toISOString().slice(0, 10)}.`,
            );
        } catch (error) {
          logger.warn(
            `GOG product info fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

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
            mShortDescription: shortDescription,
            mDescription: description,
            mReleased: released ?? releaseDateOf(storeManifest?.payload),
            mIconObjectId: "",
            mBannerObjectId: "",
            mCoverObjectId: "",
            mImageLibraryObjectIds: [],
          },
        });

        // Provider art (best-effort): the store page carries banner, box
        // cover and screenshots without any API key; when it is unreachable
        // the cached library tile still gives us the hero banner. Only empty
        // fields are filled, so a manual pick survives a re-ingest.
        try {
          const { fetchGogStoreArt, cachedManifestArt, attachProviderArt } =
            await import("./provider-art");
          const slug = (storeManifest?.payload as { slug?: unknown } | null)
            ?.slug;
          let art =
            typeof slug === "string" && slug
              ? await fetchGogStoreArt(slug)
              : undefined;
          if (!art) art = cachedManifestArt(storeManifest?.image);
          const filled = art
            ? await attachProviderArt(game.id, art, logger)
            : 0;
          logger.info(
            filled > 0
              ? `Attached provider art (${filled} fields).`
              : "No provider art attached.",
          );
        } catch (error) {
          logger.warn(
            `Provider art fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

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

export async function queueLocalUbisoftIngest(
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
    import("./connection-store"),
    import("./connections"),
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
  const { streamUbisoftGameToDepot } = await import("../ubisoft/game-streamer");

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

/**
 * Fallback release date from the cached store listing; epoch when unknown.
 * A GOG library row usually carries no date at all, so the catalogue API in
 * the acquisition task is what really fills this field.
 */
function releaseDateOf(payload: unknown): Date {
  const doc = payload as {
    releaseDate?: string;
    releaseGlobal?: { releaseDate?: string };
  } | null;
  const raw = doc?.releaseGlobal?.releaseDate ?? doc?.releaseDate;
  const parsed = raw ? new Date(raw) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0);
}
