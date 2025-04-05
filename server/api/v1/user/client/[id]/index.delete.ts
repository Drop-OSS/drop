import aclManager from "~/server/internal/acls";
import clientHandler from "~/server/internal/clients/handler";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["clients:revoke"]);
  if (!userId) throw createError({ statusCode: 403 });

  const clientId = getRouterParam(h3, "id");
  if (!clientId)
    throw createError({
      statusCode: 400,
      statusMessage: "Client ID missing in route params",
    });

  await clientHandler.removeClient(clientId);
});
