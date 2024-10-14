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
  if (!gameId || !versionName || !platform || (!delta && !startup))
    throw createError({
      statusCode: 400,
      statusMessage:
        "Missing id, version, platform, setup or startup from body",
    });

  const taskId = await libraryManager.importVersion(
    gameId,
    versionName,
    {
      platform,
      startup,
      setup,
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
