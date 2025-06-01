import { type } from "arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

const ImportVersion = type({
  id: "string",
  version: "string",

  platform: "string",
  launch: "string = ''",
  launchArgs: "string = ''",
  setup: "string = ''",
  setupArgs: "string = ''",
  onlySetup: "boolean = false",
  delta: "boolean = false",
  umuId: "string = ''",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const {
    id,
    version,
    platform,
    launch,
    launchArgs,
    setup,
    setupArgs,
    onlySetup,
    delta,
    umuId,
  } = await readValidatedBody(h3, ImportVersion);

  const platformParsed = parsePlatform(platform);
  if (!platformParsed)
    throw createError({ statusCode: 400, statusMessage: "Invalid platform." });

  if (delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: { gameId: id, platform: platformParsed, delta: false },
    });
    if (validOverlayVersions == 0)
      throw createError({
        statusCode: 400,
        statusMessage:
          "Update mode requires a pre-existing version for this platform.",
      });
  }

  if (onlySetup) {
    if (!setup)
      throw createError({
        statusCode: 400,
        statusMessage: 'Setup required in "setup mode".',
      });
  } else {
    if (!delta && !launch)
      throw createError({
        statusCode: 400,
        statusMessage: "Startup executable is required for non-update versions",
      });
  }

  // startup & delta require more complex checking logic
  const taskId = await libraryManager.importVersion(id, version, {
    platform,
    onlySetup,

    launch,
    launchArgs,
    setup,
    setupArgs,

    umuId,
    delta,
  });
  if (!taskId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid options for import",
    });

  return { taskId: taskId };
});
