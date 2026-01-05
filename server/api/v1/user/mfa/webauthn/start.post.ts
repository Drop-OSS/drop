import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import sessionHandler from "~/server/internal/session";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getRpId } from "~/server/internal/auth/webauthn";
import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";

const CreatePasskey = type({
  name: "string",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const body = await readDropValidatedBody(h3, CreatePasskey);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true },
  });
  if (!user)
    throw createError({
      statusCode: 500,
      message: "Session refers to non-existed user.",
    });

  const rpID = await getRpId();

  const registrationOptions = await generateRegistrationOptions({
    rpID,
    rpName: "Drop",
    userName: user.username,
    attestationType: "none",
    authenticatorSelection: {
      requireResidentKey: true,
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  await sessionHandler.setSessionDataKey(
    h3,
    "webauthn/options",
    JSON.stringify(registrationOptions),
  );

  await sessionHandler.setSessionDataKey(h3, "webauthn/passkeyname", body.name);

  return registrationOptions;
});
