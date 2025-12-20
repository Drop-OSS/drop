import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import { parsePlatform } from "~/server/internal/utils/parseplatform";

export const ImportVersion = type({
  id: "string",
  version: "string",
  displayName: "string?",

  platform: "string",
  launch: "string?",
  launchArgs: "string?",
  setup: "string?",
  setupArgs: "string?",
  onlySetup: "boolean = false",
  delta: "boolean = false",
  umuId: "string?",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, ImportVersion);

  const platformParsed = parsePlatform(body.platform);
  if (!platformParsed)
    throw createError({ statusCode: 400, statusMessage: "Invalid platform." });

  if (body.delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: {
        gameId: body.id,
        delta: false,
        launches: { some: { platform: platformParsed } },
      },
    });
    if (validOverlayVersions == 0)
      throw createError({
        statusCode: 400,
        statusMessage: "Update mode requires a pre-existing version.",
      });
  }

  if (body.onlySetup) {
    if (!body.setup)
      throw createError({
        statusCode: 400,
        statusMessage: 'Setup required in "setup mode".',
      });
  } else {
    if (!body.delta && !body.launch)
      throw createError({
        statusCode: 400,
        statusMessage: "Launch executable is required for non-update versions",
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
