import aclManager from "~/server/internal/acls";
import clientHandler from "~/server/internal/clients/handler";

/**
 * Revoke client
 * @param id Client ID
 */
export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, ["clients:revoke"]);
  if (!userId) throw createError({ statusCode: 403 });

  const clientId = getRouterParam(h3, "id")!;

  await clientHandler.removeClient(clientId);
});
