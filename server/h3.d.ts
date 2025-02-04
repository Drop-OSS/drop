import { CertificateAuthority } from "./internal/clients/ca";
import { MetadataHandler } from "./internal/metadata";
import { ObjectBackend } from "./internal/objects";
import { SessionHandler } from "./internal/session";

export * from "h3";
declare module "h3" {
  interface H3EventContext {
    ca: CertificateAuthority;
    objects: ObjectBackend;
  }
}

export type MinimumRequestObject = { headers: Headers };
