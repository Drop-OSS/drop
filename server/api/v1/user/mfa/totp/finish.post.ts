import aclManager from "~/server/internal/acls";
import { totp, generateKey, getKeyUri, SecretKey } from "otp-io";
import { hmac, randomBytes } from "otp-io/crypto";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";
import {
  dropDecodeArray,
  dropEncodeArray,
  TOTPv1Credentials,
} from "~/server/internal/auth/totp";
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
  const secretKeyBuffer = dropDecodeArray(secret);
  const secretKey = new SecretKey(secretKeyBuffer);

  const code = await totp(hmac, { secret: secretKey });
  if (body.code !== code)
    throw createError({ statusCode: 400, message: "Invalid TOTP code." });

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
