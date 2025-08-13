import { APITokenMode } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

/**
 * Complete setup, and delete setup token.
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["setup"]);
  if (!allowed)
    throw createError({
      statusCode: 403,
      statusMessage: "Must use a setup token.",
    });
  await prisma.aPIToken.deleteMany({
    where: {
      mode: APITokenMode.System,
      acls: {
        hasSome: ["setup"],
      },
    },
  });
});
