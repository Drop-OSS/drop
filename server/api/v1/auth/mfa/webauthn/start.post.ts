import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { MFAMec } from "~/prisma/client/enums";
import type { WebAuthNv1Credentials } from "~/server/internal/auth/webauthn";
import { getRpId } from "~/server/internal/auth/webauthn";
import prisma from "~/server/internal/db/database";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const session = await sessionHandler.getSession(h3);
  if (!session || !session.authenticated || session.authenticated.level == 0)
    throw createError({
      statusCode: 403,
      message: "Sign in before completing MFA",
    });

  const mec = await prisma.linkedMFAMec.findUnique({
    where: {
      userId_mec: {
        userId: session.authenticated.userId,
        mec: MFAMec.WebAuthn,
      },
    },
  });
  if (!mec)
    throw createError({
      statusCode: 400,
      message: "WebAuthn not enabled on account.",
    });

  const rpID = await getRpId();
  const passkeys = (mec.credentials as unknown as WebAuthNv1Credentials)
    .passkeys;

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((v) => ({
      id: v.id,
      transports: v.transports ?? [],
    })),
  });

  await sessionHandler.setSessionDataKey(
    h3,
    "webauthn/options",
    JSON.stringify(options),
  );

  return options;
});
