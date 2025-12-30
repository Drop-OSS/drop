import aclManager from "~/server/internal/acls";
import { totp, generateKey, getKeyUri } from "otp-io";
import { hmac, randomBytes } from "otp-io/crypto";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";
import {
  TOTPv1Credentials,
  dropEncodeArray,
} from "~/server/internal/auth/totp";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const existing = await prisma.linkedMFAMec.findUnique({
    where: {
      userId_mec: {
        userId,
        mec: MFAMec.TOTP,
      },
    },
  });
  if (existing)
    throw createError({
      statusCode: 400,
      message: "Cannot add TOTP authentication if already exists.",
    });

  const secret = generateKey(randomBytes, /* bytes: */ 20); // 5-20 good for Google Authenticator
  const url = getKeyUri({
    type: "totp",
    secret,
    name: userId,
    issuer: "Drop",
  });

  await prisma.linkedMFAMec.create({
    data: {
      userId,
      mec: MFAMec.TOTP,
      version: 1,
      credentials: {
        secret: dropEncodeArray(secret.bytes),
      } satisfies TOTPv1Credentials,
      enabled: false,
    },
  });

  return { url, secret };
});
