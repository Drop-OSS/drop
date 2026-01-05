import aclManager from "~/server/internal/acls";
import { generateKey, getKeyUri } from "otp-io";
import { randomBytes } from "otp-io/crypto";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";
import type { TOTPv1Credentials } from "~/server/internal/auth/totp";
import { dropEncodeArrayBase64 } from "~/server/internal/auth/totp";
import { b32e } from "~/server/internal/auth/base32";

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

  if (existing) {
    if (!existing.enabled) {
      // Safe because we're updating something we just queried
      // eslint-disable-next-line drop/no-prisma-delete
      await prisma.linkedMFAMec.delete({
        where: { userId_mec: { userId: existing.userId, mec: existing.mec } },
      });
    } else {
      throw createError({
        statusCode: 400,
        message: "Cannot set up TOTP authentication if already exists.",
      });
    }
  }

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
        secret: dropEncodeArrayBase64(secret.bytes),
      } satisfies TOTPv1Credentials,
      enabled: false,
    },
  });

  return { url, secret: b32e(secret.bytes) };
});
