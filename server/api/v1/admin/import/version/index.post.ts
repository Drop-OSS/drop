import { type } from "arktype";
import { PlatformClient } from "~/composables/types";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export const ImportVersion = type({
  id: "string",
  version: "string",

  platform: type.valueOf(PlatformClient),

  launch: "string = ''",
  launchArgs: "string = ''",

  setup: "string = ''",
  setupArgs: "string = ''",

  onlySetup: "boolean = false",
  hide: "boolean = false",

  delta: "boolean = false",
  umuId: "string = ''",
}).configure(throwingArktype);

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
    hide,
  } = await readDropValidatedBody(h3, ImportVersion);

  if (delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: { gameId: id, platform, delta: false },
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
        statusMessage: "Launch executable is required for non-update versions",
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
    hide,

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
