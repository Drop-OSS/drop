import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const id = query.id?.toString();
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "id required in fetching invitation",
    });
  taskHandler.runTaskGroupByName("cleanup:invitations");

  const invitation = await prisma.invitation.findUnique({ where: { id: id } });
  if (!invitation)
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid or expired invitation",
    });

  return invitation;
});
