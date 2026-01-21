import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { MFAMec } from "~/prisma/client/enums";
import { dropDecodeArrayBase64 } from "~/server/internal/auth/totp";
import type { WebAuthNv1Credentials } from "~/server/internal/auth/webauthn";
import { getRpId } from "~/server/internal/auth/webauthn";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);
  const credentialId = body?.id;
  if (!credentialId || typeof credentialId !== "string")
    throw createError({
      statusCode: 400,
      message: "Missing credential id in body.",
    });

  const optionsRaw = await sessionHandler.getSessionDataKey<string>(
    h3,
    "webauthn/options",
  );
  if (!optionsRaw)
    throw createError({
      statusCode: 400,
      message: "WebAuthn setup not started for this session.",
    });
  const options = JSON.parse(optionsRaw);
  await sessionHandler.deleteSessionDataKey(h3, "webauthn/challenge");

  // See WebAuthNv1Credentials for schema
  const mfaMec = await prisma.linkedMFAMec.findFirst({
    where: {
      credentials: {
        path: ["passkeys"],
        array_contains: [
          {
            id: credentialId,
          },
        ],
      },
    },
  });
  if (!mfaMec)
    throw createError({ statusCode: 404, message: "Passkey not found" });

  const passkeys = (mfaMec.credentials as unknown as WebAuthNv1Credentials)
    .passkeys;
  const passkeyIndex = passkeys.findIndex((v) => v.id === credentialId);
  const passkey = passkeys[passkeyIndex]; // Exists guarantee by database

  const rpID = await getRpId();
  const externalUrl = await systemConfig.getExternalUrl();
  const url = new URL(externalUrl);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: options.challenge,
      expectedOrigin: url.origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: Buffer.from(dropDecodeArrayBase64(passkey.publicKey)),
        counter: passkey.counter,
        transports: passkey.transports ?? [],
      },
    });
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: (error as string)?.toString(),
    });
  }

  const { verified } = verification;
  if (!verified)
    throw createError({ statusCode: 403, message: "Invalid passkey." });

  const { authenticationInfo } = verification;
  const { newCounter } = authenticationInfo;

  passkeys[passkeyIndex].counter = newCounter;
  (mfaMec.credentials as unknown as WebAuthNv1Credentials).passkeys = passkeys;

  // Safe because we query it before
  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.linkedMFAMec.update({
    where: {
      userId_mec: {
        userId: mfaMec.userId,
        mec: MFAMec.WebAuthn,
      },
    },
    data: {
      credentials: mfaMec.credentials!,
    },
  });

  await sessionHandler.signin(h3, mfaMec.userId, {
    rememberMe: true,
  });
  await sessionHandler.mfa(h3, 10);

  return {};
});
