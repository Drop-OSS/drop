import { ArkErrors, type } from "arktype";
import { systemConfig } from "../config/sys-conf";
import { dropDecodeArrayBase64 } from "./totp";
import { decode } from "cbor2";
import { createHash } from "node:crypto";
import cosekey from "parse-cosekey";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

export async function getRpId() {
  const externalUrl =
    process.env.WEBAUTHN_DOMAIN ?? (await systemConfig.getExternalUrl());
  const externalUrlParsed = new URL(externalUrl);

  return externalUrlParsed.hostname;
}

export interface Passkey {
  name: string;
  created: number;
  userId: string;
  webAuthnUserId: string;
  id: string;
  publicKey: string;
  counter: number;
  transports: Array<AuthenticatorTransportFuture> | undefined;
  deviceType: string;
  backedUp: boolean;
}

export interface WebAuthNv1Credentials {
  passkeys: Array<Passkey>;
}

const ClientData = type({
  type: "'webauthn.create'",
  challenge: "string",
  origin: "string",
});

const AuthData = type({
  fmt: "string",
  authData: "TypedArray.Uint8",
});

export async function parseAndValidatePasskeyCreation(
  clientDataString: string,
  attestationObjectString: string,
  challenge: string,
) {
  const clientData = dropDecodeArrayBase64(clientDataString);
  const attestationObject = dropDecodeArrayBase64(attestationObjectString);

  const utf8Decoder = new TextDecoder("utf-8");
  const decodedClientData = utf8Decoder.decode(clientData);
  const clientDataObj = ClientData(JSON.parse(decodedClientData));
  if (clientDataObj instanceof ArkErrors)
    throw createError({
      statusCode: 400,
      message: `Invalid client data JSON object: ${clientDataObj.summary}`,
    });

  const convertedChallenge = Buffer.from(
    dropDecodeArrayBase64(clientDataObj.challenge),
  ).toString("utf8");

  if (convertedChallenge !== challenge)
    throw createError({
      statusCode: 400,
      message: "Challenge does not match.",
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
  // const aaguid = attestedCredentialData.slice(0, 16);
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

  return {
    credentialIdStr,
    jwk,
  };
}
