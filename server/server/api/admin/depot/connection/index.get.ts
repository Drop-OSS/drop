import { createError, defineEventHandler } from "h3";
import aclManager from "~/server/internal/acls";
import { maskConnection } from "../../../../utils/depot/connections";
import { prismaConnectionStore } from "../../../../utils/depot/connection-store";

/** Lists stored store-account connections without ever exposing credentials. */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const rows = await prismaConnectionStore.list();
  return { connections: rows.map(maskConnection) };
});
