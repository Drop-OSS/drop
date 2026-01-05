import aclManager from "~/server/internal/acls";
import { totp, SecretKey } from "otp-io";
import { hmac } from "otp-io/crypto";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";
import type { TOTPv1Credentials } from "~/server/internal/auth/totp";
import { dropDecodeArrayBase64 } from "~/server/internal/auth/totp";
import { createError } from "h3";
import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";

const TOTPEnableBody = type({
  code: "string",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const body = await readDropValidatedBody(h3, TOTPEnableBody);

  const existing = await prisma.linkedMFAMec.findUnique({
    where: {
      userId_mec: {
        userId,
        mec: MFAMec.TOTP,
      },
      enabled: false,
    },
  });
  if (!existing)
    throw createError({ statusCode: 400, message: "TOTP not started" });

  const secret = (existing.credentials as unknown as TOTPv1Credentials).secret;
  const secretKeyBuffer = dropDecodeArrayBase64(secret);
  const secretKey = new SecretKey(secretKeyBuffer);

  const code = await totp(hmac, { secret: secretKey });
  if (body.code !== code)
    throw createError({ statusCode: 400, message: "Invalid TOTP code." });

  // Safe because we're updating something we just queried
  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.linkedMFAMec.update({
    where: {
      userId_mec: {
        userId,
        mec: MFAMec.TOTP,
      },
    },
    data: {
      enabled: true,
    },
  });

  return;
});
