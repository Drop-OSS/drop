import { CertificateAuthority } from "../internal/clients/ca";
import { dbCertificateStore } from "../internal/clients/ca-store";

let ca: CertificateAuthority | undefined;

export const useCertificateAuthority = () => {
  if (!ca) throw new Error("CA not initialised");
  return ca;
};

export default defineNitroPlugin(async () => {
  // const store = fsCertificateStore();

  ca = await CertificateAuthority.new(dbCertificateStore());
});
