import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.getUserACL(h3, ["settings:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  let game = await prisma.game.findFirst({ where: { isHidden: false } });
  if (!game) {
    game = await prisma.game.findFirst({ where: { isHidden: true } });
  }
  if (!game) {
    const t = await useTranslation(h3);
    throw createError({
      statusCode: 500,
      statusMessage: t("errors.admin.settings.missingDummyData"),
    });
  }

  return {
    gamePanel: {
      id: game.id,
      mCoverObjectId: game.mCoverObjectId,
      mName: game.mName,
      mShortDescription: game.mShortDescription,
    },
  };
});
