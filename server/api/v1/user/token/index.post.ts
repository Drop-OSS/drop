import { type } from "arktype";
import { APITokenMode } from "~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager, { userACLs } from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const CreateToken = type({
  name: "string",
  acls: "string[] > 0",
}).configure(throwingArktype);

/**
 *
 */
export default defineEventHandler<{ body: typeof CreateToken.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
    if (!userId) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, CreateToken);
    const name: string = body.name;
    const acls: string[] = body.acls;

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
  },
);
