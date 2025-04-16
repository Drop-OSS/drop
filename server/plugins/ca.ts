import { CertificateAuthority } from "../internal/clients/ca";
import { dbCertificateStore } from "../internal/clients/ca-store";

let ca: CertificateAuthority | undefined;

export const useCertificateAuthority = () => {
  if (!ca) throw new Error("CA not initialised");
  return ca;
};

export default defineNitroPlugin(async () => {
  // const basePath = process.env.CLIENT_CERTIFICATES ?? "./certs";
  // fs.mkdirSync(basePath, { recursive: true });
  // const store = fsCertificateStore(basePath);

  ca = await CertificateAuthority.new(dbCertificateStore());
});
