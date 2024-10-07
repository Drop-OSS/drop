import path from "path";
import fs from "fs";
import { CertificateBundle } from "./ca";

export type CertificateStore = {
  store(name: string, data: CertificateBundle): Promise<void>;
  fetch(name: string): Promise<CertificateBundle | undefined>;
};

export const fsCertificateStore = (base: string) => {
  const store: CertificateStore = {
    async store(name: string, data: CertificateBundle) {
      const filepath = path.join(base, name);
      fs.writeFileSync(filepath, JSON.stringify(data));
    },
    async fetch(name: string) {
      const filepath = path.join(base, name);
      if (!fs.existsSync(filepath)) return undefined;
      return JSON.parse(fs.readFileSync(filepath, "utf-8"));
    },
  };
  return store;
};
