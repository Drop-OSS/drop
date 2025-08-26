import { type } from "arktype";
import { Platform } from "~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export const ImportVersion = type({
  id: "string",
  version: "string",
  name: "string?",

  platform: type.valueOf(Platform),
  setup: "string = ''",
  setupArgs: "string = ''",
  onlySetup: "boolean = false",
  delta: "boolean = false",
  umuId: "string = ''",

  launches: type({
    name: "string > 0",
    description: "string = ''",
    launchCommand: "string > 0",
    launchArgs: "string = ''",
  }).array(),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, ImportVersion);

  if (body.delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: {
        version: { gameId: body.id, platform: body.platform },
        delta: false,
      },
    });
    if (validOverlayVersions == 0)
      throw createError({
        statusCode: 400,
        statusMessage:
          "Update mode requires a pre-existing version for this platform.",
      });
  }

  if (body.onlySetup) {
    if (!body.setup)
      throw createError({
        statusCode: 400,
        statusMessage: 'Setup required in "setup mode".',
      });
  } else {
    if (!body.delta && body.launches.length == 0)
      throw createError({
        statusCode: 400,
        statusMessage:
          "At least one launch command is required for non-delta versions",
      });
  }

  // startup & delta require more complex checking logic
  const taskId = await libraryManager.importVersion(
    body.id,
    body.version,
    body,
  );
  if (!taskId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid options for import",
    });

  return { taskId: taskId };
});
