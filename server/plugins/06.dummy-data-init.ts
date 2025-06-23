import fs from "fs";
import prisma from "~/server/internal/db/database";
import { ObjectTransactionalHandler } from "../internal/objects/transactional";
import { DateTime } from "luxon";
import { MetadataSource } from "~/prisma/client";

export default defineNitroPlugin(async () => {
  const user = await prisma.user.findUnique({ where: { id: "system" } });
  if (!user) {
    console.error("System user not found. Dummy data was not imported.");
    return;
  }
  const path = `${process.cwd()}/server/plugins/dummy-data/game-panel-placeholder.png`;
  fs.readFile(path, async (error, fileBuffer) => {
    if (error) {
      console.error(
        `Could not open file: ${path}. Error: ${error.message}. Dummy data was not imported.`,
      );
      return;
    }

    const isDummyGameAlreadyImported =
      (await prisma.game.count({ where: { isHidden: true, id: "system" } })) >
      0;

    if (isDummyGameAlreadyImported) {
      console.info("Dummy data already imported. Skipping import.");
      return;
    }

    const transactionalHandler = new ObjectTransactionalHandler();
    const [add, pull, _dump] = transactionalHandler.new({}, ["internal:read"]);

    // Add file to transaction handler so we can void it later if we error out
    const id = add(fileBuffer);
    console.log(`File ID: ${id}`);
    pull();

    const dummyGameParams = {
      id: "system",
      isHidden: true,
      mCoverObjectId: id,
      mShortDescription: "This is a sample short description",
      mDescription: "This is a sample long description",
      metadataSource: MetadataSource.Manual,
      mName: "Drop Game",
      libraryPath: "",
      mReleased: DateTime.fromISO("2025-01-01T00:00:00+0000").toJSDate(),
      mIconObjectId: id,
      metadataId: "",
      mBannerObjectId: id,
    };

    await prisma.game.create({ data: dummyGameParams });
  });
});
