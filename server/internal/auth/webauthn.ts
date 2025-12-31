import { systemConfig } from "../config/sys-conf";

export async function getRpId() {
  const externalUrl =
    process.env.WEBAUTHN_DOMAIN ?? (await systemConfig.getExternalUrl());
  const externalUrlParsed = new URL(externalUrl);

  return externalUrlParsed.hostname;
}

export interface WebAuthNv1Credentials {
  credentials: Array<{ id: string; jwk: JsonWebKey, name: string, created: number }>;
}
