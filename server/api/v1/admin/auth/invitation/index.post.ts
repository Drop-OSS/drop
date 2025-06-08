import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { CreateUserValidator } from "../../../auth/signup/simple.post";

const CreateInvite = CreateUserValidator.and({
  expires: "Date",
  isAdmin: "boolean = false",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "auth:simple:invitation:new",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, CreateInvite);

  console.log(body);

  const invitation = await prisma.invitation.create({
    data: body,
  });

  return invitation;
});
