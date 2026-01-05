import aclManager from "~/server/internal/acls";
import { dropEncodeArrayBase64 } from "~/server/internal/auth/totp";
import type { WebAuthNv1Credentials } from "~/server/internal/auth/webauthn";
import { getRpId } from "~/server/internal/auth/webauthn";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/enums";
import sessionHandler from "~/server/internal/session";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { systemConfig } from "~/server/internal/config/sys-conf";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const body = await readBody(h3);

  const optionsRaw = await sessionHandler.getSessionDataKey<string>(
    h3,
    "webauthn/options",
  );
  if (!optionsRaw)
    throw createError({
      statusCode: 400,
      message: "WebAuthn not started for this session.",
    });
  const options: PublicKeyCredentialCreationOptionsJSON =
    JSON.parse(optionsRaw);
  await sessionHandler.deleteSessionDataKey(h3, "webauthn/options");

  const rpID = await getRpId();
  const externalUrl = await systemConfig.getExternalUrl();
  const url = new URL(externalUrl);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: options.challenge,
      expectedOrigin: url.origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    console.error(error);
    throw createError({
      statusCode: 400,
      message: (error as string)?.toString(),
    });
  }

  const webauthnMec =
    (await prisma.linkedMFAMec.findUnique({
      where: { userId_mec: { userId, mec: MFAMec.WebAuthn } },
    })) ??
    (await prisma.linkedMFAMec.create({
      data: {
        userId,
        mec: MFAMec.WebAuthn,
        credentials: { passkeys: [] } satisfies WebAuthNv1Credentials,
        version: 1,
      },
    }));

  const { verified, registrationInfo } = verification;
  if (!verified)
    throw createError({
      statusCode: 400,
      message: "Failed to verify passkey.",
    });
  const { credential, credentialDeviceType, credentialBackedUp } =
    registrationInfo!;

  const name = await sessionHandler.getSessionDataKey<string>(
    h3,
    "webauthn/passkeyname",
  );

  (webauthnMec.credentials as unknown as WebAuthNv1Credentials).passkeys.push({
    name: name ?? "My New Passkey",
    created: Date.now(),
    userId,
    webAuthnUserId: options.user.id,
    id: credential.id,
    publicKey: dropEncodeArrayBase64(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
  });

  // Safe because we're updating something we just queried
  // eslint-disable-next-line drop/no-prisma-delete
  await prisma.linkedMFAMec.update({
    where: {
      userId_mec: {
        userId: webauthnMec.userId,
        mec: webauthnMec.mec,
      },
    },
    data: {
      credentials: webauthnMec.credentials!,
    },
  });

  return;
});
