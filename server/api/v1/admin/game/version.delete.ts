import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const user = await h3.context.session.getAdminUser(h3);
  if (!user) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const gameId = body.id.toString();
  const version = body.versionName.toString();
  if (!gameId || !version)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing ID or versionName in body",
    });

  await prisma.gameVersion.delete({
    where: {
      gameId_versionName: {
        gameId: gameId,
        versionName: version,
      },
    },
  });

  return {};
});
