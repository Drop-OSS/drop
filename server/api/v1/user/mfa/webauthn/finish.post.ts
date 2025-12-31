import { ArkErrors, type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import { decode } from "cbor2";
import { dropDecodeArrayBase64 } from "~/server/internal/auth/totp";
import {
  getRpId,
  WebAuthNv1Credentials,
} from "~/server/internal/auth/webauthn";
import { createHash } from "node:crypto";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/enums";
import cosekey from "parse-cosekey";

const CreatePasskey = type({
  name: "string",
  clientData: "string",
  attestationObject: "string",
}).configure(throwingArktype);

const ClientData = type({
  type: "'webauthn.create'",
  challenge: "string",
  origin: "string",
});

const AuthData = type({
  fmt: "string",
  authData: "TypedArray.Uint8",
});

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const body = await readDropValidatedBody(h3, CreatePasskey);

  const clientData = dropDecodeArrayBase64(body.clientData);
  const attestationObject = dropDecodeArrayBase64(body.attestationObject);

  const utf8Decoder = new TextDecoder("utf-8");
  const decodedClientData = utf8Decoder.decode(clientData);
  const clientDataObj = ClientData(JSON.parse(decodedClientData));
  if (clientDataObj instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      message: `Invalid client data JSON object: ${clientDataObj.summary}`,
    });

  const tmp = decode(attestationObject);
  const decodedAttestationObject = AuthData(tmp);
  if (decodedAttestationObject instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      message: `Invalid attestation object: ${decodedAttestationObject.summary}`,
    });

  const userRpIdHash = decodedAttestationObject.authData.slice(0, 32);
  const rpId = await getRpId();
  const rpIdHash = createHash("sha256").update(rpId).digest();

  if (!rpIdHash.equals(userRpIdHash))
    throw createError({
      statusCode: 400,
      message: "Incorrect relying party ID",
    });

  const attestedCredentialData = decodedAttestationObject.authData.slice(37);
  if (attestedCredentialData.length < 18)
    throw createError({
      statusCode: 400,
      message:
        "Attested credential data is missing AAGUID and/or credentialIdLength",
    });
  const aaguid = attestedCredentialData.slice(0, 16);
  const credentialIdLengthBuffer = attestedCredentialData.slice(16, 18);
  const credentialIdLength = Buffer.from(credentialIdLengthBuffer).readUintBE(
    0,
    2,
  );
  if (attestedCredentialData.length < 18 + credentialIdLength)
    throw createError({
      statusCode: 400,
      message: "Missing credential data of length: " + credentialIdLength,
    });
  const credentialId = attestedCredentialData.slice(
    18,
    18 + credentialIdLength,
  );
  const credentialPublicKey: Map<number, number> = decode(
    attestedCredentialData.slice(18 + credentialIdLength),
  );
  if (!(credentialPublicKey instanceof Map))
    throw createError({
      statusCode: 400,
      message: "Could not decode public key from attestion credential data",
    });

  const credentialIdStr = Buffer.from(credentialId).toString("hex");
  const jwk = cosekey.KeyParser.cose2jwk(credentialPublicKey);

  console.log(credentialIdStr, jwk);

  const webauthnMec =
    (await prisma.linkedMFAMec.findUnique({
      where: { userId_mec: { userId, mec: MFAMec.WebAuthn } },
    })) ??
    (await prisma.linkedMFAMec.create({
      data: {
        userId,
        mec: MFAMec.WebAuthn,
        credentials: { credentials: [] } satisfies WebAuthNv1Credentials,
        version: 1,
      },
    }));

  (
    webauthnMec.credentials as unknown as WebAuthNv1Credentials
  ).credentials.push({
    id: credentialIdStr,
    jwk,
    name: body.name,
    created: Date.now(),
  });

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
