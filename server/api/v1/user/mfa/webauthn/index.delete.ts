import { aclManager } from "~/server/internal/acls";
import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";
import type { WebAuthNv1Credentials } from "~/server/internal/auth/webauthn";

const WebAuthnDelete = type({
  id: "string",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const body = await readDropValidatedBody(h3, WebAuthnDelete);

  const webauthnMec = await prisma.linkedMFAMec.findUnique({
    where: { userId_mec: { userId, mec: MFAMec.WebAuthn } },
  });

  if (!webauthnMec)
    throw createError({ statusCode: 400, message: "WebAuthn not enabled." });

  const credentials =
    webauthnMec.credentials as unknown as WebAuthNv1Credentials;
  const index = credentials.passkeys.findIndex((v) => v.id === body.id);
  credentials.passkeys.splice(index, 1);

  // SAFETY: we request the object further up
  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.linkedMFAMec.update({
    where: {
      userId_mec: {
        userId,
        mec: MFAMec.WebAuthn,
      },
    },
    data: {
      // This works, I don't know why the types don't line up
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credentials: credentials as any,
    },
  });
});
