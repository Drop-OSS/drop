import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";
import authManager from "~/server/internal/auth";
import { ArkErrors, type } from "arktype";

const Query = type({
  id: "string",
});

/**
 * Fetch invitation details for pre-filling
 */
export default defineEventHandler<{ query: typeof Query.infer }>(async (h3) => {
  const t = await useTranslation(h3);

  if (!authManager.getAuthProviders().Simple)
    throw createError({
      statusCode: 403,
      statusMessage: t("errors.auth.method.signinDisabled"),
    });

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid query: " + query.summary,
    });
  const id = query.id;
  taskHandler.runTaskGroupByName("cleanup:invitations");

  const invitation = await prisma.invitation.findUnique({ where: { id: id } });
  if (!invitation)
    throw createError({
      statusCode: 404,
      statusMessage: t("errors.auth.invalidInvite"),
    });

  return invitation;
});
