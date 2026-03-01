import prisma from "~/server/internal/db/database";
import { defineDropTask, wrapTaskContext } from "..";
import { libraryManager } from "../../library";

export default defineDropTask({
  buildId: () => `import:check-integrity:${new Date().toISOString()}`,
  name: "Check version integrity",
  acls: ["system:import:version:read"],
  taskGroup: "import:check-integrity",
  async run({ progress, logger, addAction }) {
    const versions = await prisma.gameVersion.findMany({
      where: {
        versionPath: {
          not: null,
        },
      },
      select: {
        versionId: true,
        versionPath: true,
        displayName: true,
        game: {
          select: {
            libraryId: true,
            libraryPath: true,
            mName: true,
          },
        },
      },
    });

    logger.info(`Checking version integrity for ${versions.length} versions`);

    let i = 0;
    const progressStep = 100 / versions.length;
    for (const version of versions) {
      const displayName = `${version.game.mName} ${version.displayName ?? version.versionPath}`;
      logger.info(`Starting integrity check for ${displayName}`);

      const library = await libraryManager.getLibrary(version.game.libraryId);
      if (!library) {
        logger.warn(`No library for ${displayName}`);
        continue;
      }

      const min = i * progressStep;
      const max = (i + 1) * progressStep;
      const taskContext = wrapTaskContext(
        { progress, logger, addAction },
        { min, max, prefix: `re-check ${displayName}` },
      );

      const manifest = await library.generateDropletManifest(
        version.game.libraryPath,
        version.versionPath!,
        taskContext.progress,
        (value) => {
          taskContext.logger.info(value);
        },
      );

      // SAFETY: this is requested from the database
      // eslint-disable-next-line drop/no-prisma-delete
      await prisma.gameVersion.update({
        where: {
          versionId: version.versionId,
        },
        data: {
          versionId: crypto.randomUUID(),
          dropletManifest: manifest,
        },
      });

      logger.info(`Finished integrity check for ${displayName}`);
      i++;
    }

    logger.info("Done");
    progress(100);
  },
});
