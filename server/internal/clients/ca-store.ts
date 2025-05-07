import path from "path";
import fs from "fs";
import type { CertificateBundle } from "./ca";
import prisma from "../db/database";

export type CertificateStore = {
  store(name: string, data: CertificateBundle): Promise<void>;
  fetch(name: string): Promise<CertificateBundle | undefined>;
  blacklistCertificate(name: string): Promise<void>;
  checkBlacklistCertificate(name: string): Promise<boolean>;
};

export const fsCertificateStore = (base: string) => {
  const blacklist = path.join(base, ".blacklist");
  fs.mkdirSync(blacklist, { recursive: true });
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
    async blacklistCertificate(name: string) {
      const filepath = path.join(blacklist, name);
      fs.writeFileSync(filepath, Buffer.from([]));
    },
    async checkBlacklistCertificate(name: string): Promise<boolean> {
      const filepath = path.join(blacklist, name);
      return fs.existsSync(filepath);
    },
  };
  return store;
};

export const dbCertificateStore = () => {
  const store: CertificateStore = {
    async store(name: string, data: CertificateBundle) {
      await prisma.certificate.upsert({
        where: {
          id: name,
        },
        create: {
          id: name,
          privateKey: data.priv,
          certificate: data.cert,
        },
        update: {
          privateKey: data.priv,
          certificate: data.cert,
        },
      });
    },
    async fetch(name: string) {
      const result = await prisma.certificate.findUnique({
        where: {
          id: name,
        },
        select: {
          privateKey: true,
          certificate: true,
        },
      });
      if (result === null) return undefined;
      return {
        priv: result.privateKey,
        cert: result.certificate,
      };
    },
    async blacklistCertificate(name: string) {
      try {
        await prisma.certificate.update({
          where: {
            id: name,
          },
          data: {
            blacklisted: true,
          },
        });
      } finally {
      }
    },
    async checkBlacklistCertificate(name: string): Promise<boolean> {
      const result = await prisma.certificate.findUnique({
        where: {
          id: name,
        },
        select: {
          blacklisted: true,
        },
      });
      if (result === null) return true;
      return result.blacklisted;
    },
  };
  return store;
};
