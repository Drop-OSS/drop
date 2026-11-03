import { createError, defineEventHandler, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import taskHandler from "~/server/internal/tasks";
import { formatBytes } from "~/server/internal/utils/files";
import { depotRootFor } from "~/server/utils/depot/paths";
import { publishDirectoryToCas } from "~/server/utils/depot/publish";

/**
 * Chunk one library version into the content-addressed depot and point the
 * version row at the resulting manifest, so a client can fetch the release by
 * digest instead of reading the library folder through the transfer service.
 *
 * Deliberately an explicit admin action: the chunk store holds its own copy of
 * the bytes, so the first publish of a version costs roughly one more copy of
 * it (deduped — every publish after that pays only for what changed). Nothing
 * about the existing version, its folder or its upstream manifest is touched,
 * so this is additive and safe to re-run.
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id")!;
  const versionId = getRouterParam(h3, "versionid")!;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, mName: true, libraryId: true, libraryPath: true },
  });
  if (!game)
    throw createError({ statusCode: 404, statusMessage: "Game not found" });

  const version = await prisma.gameVersion.findFirst({
    where: { versionId, gameId },
    select: {
      versionId: true,
      versionPath: true,
      displayName: true,
      casManifestDigest: true,
    },
  });
  if (!version)
    throw createError({
      statusCode: 404,
      statusMessage: "No version with that id for this game",
    });
  // A version uploaded as a ready-made manifest has no folder of files here to
  // chunk; only a library import does.
  if (!version.versionPath)
    throw createError({
      statusCode: 400,
      statusMessage:
        "This version has no library folder to chunk (it arrived as a depot manifest)",
    });

  const provider = libraryManager.getLibrary(game.libraryId);
  if (!provider)
    throw createError({
      statusCode: 400,
      statusMessage: "This game's library is not loaded on this server",
    });

  let sourceDir: string;
  try {
    sourceDir = await provider.versionLocalPath(
      game.libraryPath,
      version.versionPath,
    );
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : "Version folder not found",
    });
  }

  const label = version.displayName ?? version.versionPath;
  const taskId = await taskHandler.create({
    key: `depot:cas:${versionId}`,
    taskGroup: "depot:ingest",
    acls: ["system:import:version:read"],
    name: `Chunking "${game.mName} ${label}" for download by digest`,
    async run(context) {
      const { progress, logger } = context;
      const root = depotRootFor(systemConfig.getDataFolder());
      logger.info(`Chunking ${sourceDir} into ${root}`);

      const result = await publishDirectoryToCas({
        sourceDir,
        depotRoot: root,
        onProgress: (done, total) =>
          progress(total > 0 ? (done / total) * 99 : 99),
      });

      // The repo rule is no blind single-row writes: name the row, write, and
      // insist the row was there to write.
      const updated = await prisma.gameVersion.updateMany({
        where: { versionId },
        data: { casManifestDigest: result.digest },
      });
      if (updated.count !== 1)
        throw new Error(
          "This version was removed while it was being chunked; its chunks stay for the next release to reuse",
        );
      logger.info(
        `${result.fileCount} files, ${result.chunkCount} distinct chunks, ${formatBytes(result.totalBytes)} -> manifest ${result.digest}`,
      );
      if (
        version.casManifestDigest &&
        version.casManifestDigest !== result.digest
      )
        logger.info(
          `Previous manifest ${version.casManifestDigest} is superseded; its chunks stay until garbage collection.`,
        );
      progress(100);
      context.addAction(`View Game:/admin/library/${gameId}`);
    },
  });

  return { accepted: true, taskId, sourceDir };
});
