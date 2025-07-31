import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { SharedRegisterValidator } from "../../../auth/signup/simple.post";
import { systemConfig } from "~/server/internal/config/sys-conf";

const CreateInvite = SharedRegisterValidator.partial()
  .and({
    expires: "string",
    isAdmin: "boolean = false",
  })
  .configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:new",
    "setup",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, CreateInvite);

  const invitation = await prisma.invitation.create({
    data: body,
  });

  return {
    ...invitation,
    inviteUrl: `${systemConfig.getExternalUrl()}/auth/register?id=${invitation.id}`,
  };
});
