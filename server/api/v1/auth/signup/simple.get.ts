import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";
import authManager from "~/server/internal/auth";

export default defineEventHandler(async (h3) => {
  const t = await useTranslation(h3);

  if (!authManager.getAuthProviders().Simple)
    throw createError({
      statusCode: 403,
      message: t("errors.auth.method.signinDisabled"),
    });

  const query = getQuery(h3);
  const id = query.id?.toString();
  if (!id)
    throw createError({
      statusCode: 400,
      message: t("errors.auth.inviteIdRequired"),
    });
  taskHandler.runTaskGroupByName("cleanup:invitations");

  const invitation = await prisma.invitation.findUnique({ where: { id: id } });
  if (!invitation)
    throw createError({
      statusCode: 404,
      message: t("errors.auth.invalidInvite"),
    });

  return invitation;
});
