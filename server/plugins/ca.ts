import { CertificateAuthority } from "../internal/clients/ca";
import fs from "fs";
import { fsCertificateStore } from "../internal/clients/store";

let ca: CertificateAuthority | undefined;

export const useGlobalCertificateAuthority = () => {
  if (!ca) throw new Error("CA not initialised");
  return ca;
};

export default defineNitroPlugin(async (nitro) => {
  const basePath = process.env.CLIENT_CERTIFICATES ?? "./certs";
  fs.mkdirSync(basePath, { recursive: true });
  const store = fsCertificateStore(basePath);

  ca = await CertificateAuthority.new(store);

  nitro.hooks.hook("request", (h3) => {
    if (!ca)
      throw createError({
        statusCode: 500,
        statusMessage: "Certificate authority not initialised",
      });
    h3.context.ca = ca;
  });
});
