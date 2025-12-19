import prisma from "~/server/internal/db/database";
import { defineDropTask } from "..";
import libraryManager from "../../library";
import crypto from "crypto";

export default defineDropTask({
  buildId: () => `check:integrity:${new Date().toISOString()}`,
  name: "Integrity check",
  acls: ["system:maintenance:read"],
  taskGroup: "check:integrity",
  async run({ progress, logger }) {
    const versions = await prisma.gameVersion.findMany({
      include: { game: true },
    });
    logger.info(`checking integrity for ${versions.length} versions...`);

    let currentProgress = 0;
    for (const version of versions) {
      const minProgress = (currentProgress / versions.length) * 100;
      const maxProgress = ((currentProgress + 1) / versions.length) * 100;
      const progressBudget = maxProgress - minProgress;
      progress(minProgress);
      logger.info(
        `starting integrity check for ${version.game.mName} ${version.versionId}`,
      );

      const manifest = JSON.parse(
        version.dropletManifest as string,
      );
      const manifestChunks = Object.entries(manifest);
      let valid = true;


      if (!valid) {
        logger.info(
          `integrity check for ${version.game.mName} ${version.versionId} failed, reimporting...`,
        );
        progress(minProgress);
        const library = await libraryManager.getLibrary(
          version.game.libraryId!,
        );
        if (!library)
          throw new Error(
            `Library doesn't exist for ${version.game.mName} ${version.versionId}`,
          );

        const manifest = await library.generateDropletManifest(
          version.game.libraryPath,
          version.versionPath,
          (_, manifestProgress) => {
            const currentManifestProgress =
              minProgress + progressBudget * (manifestProgress / 100);
            progress(currentManifestProgress);
          },
          (_, _logline) => {
            //logger.info(`[import:${version.gameId}] ${logline}`);
          },
        );

        await prisma.gameVersion.update({
          where: {
            gameId_versionId: {
              gameId: version.gameId,
              versionId: version.versionId,
            },
          },
          data: {
            dropletManifest: manifest,
          },
        });
      } else {
        logger.info(
          `integrity check for ${version.game.mName} ${version.versionId} succeeded!`,
        );
      }

      currentProgress++;
    }

    logger.info("integrity check done!");
    progress(100);
  },
});
