import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { convertIDToLink } from "~/server/internal/platform/link";

export const LaunchCommands = type({
  name: "string > 0",
  description: "string = ''",
  launchCommand: "string > 0",
  launchArgs: "string = ''",
}).array();

export const ImportVersion = type({
  id: "string",
  version: "string",
  name: "string?",

  platform: "string",
  setup: "string = ''",
  setupArgs: "string = ''",
  onlySetup: "boolean = false",
  delta: "boolean = false",
  umuId: "string = ''",

  launches: LaunchCommands,
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, ImportVersion);

  const platform = await convertIDToLink(body.platform);
  if (!platform)
    throw createError({ statusCode: 400, message: "Invalid platform." });

  if (body.delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: {
        version: {
          gameId: body.id,
        },
        delta: false,
        platform,
      },
    });
    if (validOverlayVersions == 0)
      throw createError({
        statusCode: 400,
        message:
          "Update mode requires a pre-existing version for this platform.",
      });
  }

  if (body.onlySetup) {
    if (!body.setup)
      throw createError({
        statusCode: 400,
        message: 'Setup required in "setup mode".',
      });
  } else {
    if (!body.delta && body.launches.length == 0)
      throw createError({
        statusCode: 400,
        message:
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
      message: "Invalid options for import",
    });

  return { taskId: taskId };
});
