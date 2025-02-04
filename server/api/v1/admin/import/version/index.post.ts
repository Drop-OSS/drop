import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "import:version:new",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const gameId = body.id;
  const versionName = body.version;

  const platform = body.platform as string | undefined;
  const launch = (body.launch ?? "") as string;
  const launchArgs = (body.launchArgs ?? "") as string;
  const setup = (body.setup ?? "") as string;
  const setupArgs = (body.setupArgs ?? "") as string;
  const onlySetup = body.onlySetup ?? (false as boolean);
  const delta = (body.delta ?? false) as boolean;
  const umuId = (body.umuId ?? "") as string;

  if (!gameId || !versionName)
    throw createError({
      statusCode: 400,
      statusMessage: "Game ID and version are required.",
    });

  if (!platform)
    throw createError({ statusCode: 400, statusMessage: "Missing platform." });

  const platformParsed = parsePlatform(platform);
  if (!platformParsed)
    throw createError({ statusCode: 400, statusMessage: "Invalid platform." });

  if (delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: { gameId: gameId, platform: platformParsed, delta: false },
    });
    if (validOverlayVersions == 0)
      throw createError({
        statusCode: 400,
        statusMessage:
          "Update mode requires a pre-existing version for this platform.",
      });
  }

  if (umuId && typeof umuId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "If specified, UMU ID must be a string.",
    });

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
  const taskId = await libraryManager.importVersion(gameId, versionName, {
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
