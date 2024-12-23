import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const gameId = body.id;
  const versionName = body.version;
  const platform = body.platform;
  const startup = body.startup;
  const setup = body.setup ?? "";
  const delta = body.delta ?? false;
  const umuId = body.umuId;

  // startup & delta require more complex checking logic
  if (!gameId || !versionName || !platform)
    throw createError({
      statusCode: 400,
      statusMessage:
        "ID, version, platform, setup, and startup (if not in update mode) are required.",
    });

  if (umuId && typeof umuId !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "If specified, UMU ID must be a string.",
    });

  if (!delta && !startup)
    throw createError({
      statusCode: 400,
      statusMessage: "Startup executable is required for non-update versions",
    });

  if (delta) {
    const validOverlayVersions = await prisma.gameVersion.count({
      where: { gameId: gameId, platform: platform, delta: false },
    });
    if (validOverlayVersions == 0)
      throw createError({
        statusCode: 400,
        statusMessage:
          "Update mode requires a pre-existing version for this platform.",
      });
  }

  const taskId = await libraryManager.importVersion(
    gameId,
    versionName,
    {
      platform,
      startup,
      setup,
      umuId,
    },
    delta
  );
  if (!taskId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid options for import",
    });

  return { taskId: taskId };
});
