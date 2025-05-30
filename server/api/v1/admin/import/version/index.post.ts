import { type } from "arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

const ImportVersion = type({
  id: "string",
  version: "string",

  platform: "string",
  launch: "string?",
  launchArgs: "string?",
  setup: "string?",
  setupArgs: "string?",
  onlySetup: "boolean?",
  delta: "boolean?",
  umuId: "string?",
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readValidatedBody(h3, ImportVersion);
  const gameId = body.id;
  const versionName = body.version;

  const platform = body.platform;
  const launch = body.launch ?? "";
  const launchArgs = body.launchArgs ?? "";
  const setup = body.setup ?? "";
  const setupArgs = body.setupArgs ?? "";
  const onlySetup = body.onlySetup ?? false;
  const delta = body.delta ?? false;
  const umuId = body.umuId ?? "";

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
