import { APITokenMode } from "~/prisma/client";
import aclManager, { userACLs } from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const body = await readBody(h3);
  const name: string = body.name;
  const acls: string[] = body.acls;

  if (!name || typeof name !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "Token name required",
    });
  if (!acls || !Array.isArray(acls))
    throw createError({ statusCode: 400, statusMessage: "ACLs required" });

  if (acls.length == 0)
    throw createError({
      statusCode: 400,
      statusMessage: "Token requires more than zero ACLs",
    });

  const invalidACLs = acls.filter(
    (e) => userACLs.findIndex((v) => e == v) == -1,
  );
  if (invalidACLs.length > 0)
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ACLs: ${invalidACLs.join(", ")}`,
    });

  const token = await prisma.aPIToken.create({
    data: {
      mode: APITokenMode.User,
      name: name,
      userId: userId,
      acls: acls,
    },
  });

  return token;
});
