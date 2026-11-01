import { createError, defineEventHandler, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import { prismaConnectionStore } from "../../../../utils/depot/connection-store";

/** Removes a stored store-account connection (and its cached manifests). */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const id = getRouterParam(h3, "id");
  if (!id)
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  const removed = await prismaConnectionStore.remove(id);
  return { removed };
});
