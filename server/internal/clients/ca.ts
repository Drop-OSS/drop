import path from "path";
import fs from "fs";
import droplet from "@drop/droplet";
import { CertificateStore, fsCertificateStore } from "./ca-store";

export type CertificateBundle = {
  priv: string;
  cert: string;
};

/*
This is designed to handle client certificates, as described in the README.md
*/
export class CertificateAuthority {
  private certificateStore: CertificateStore;

  private root: CertificateBundle;

  constructor(store: CertificateStore, root: CertificateBundle) {
    this.certificateStore = store;
    this.root = root;
  }

  static async new(store: CertificateStore) {
    const root = await store.fetch("ca");
    let ca;
    if (root === undefined) {
      const [cert, priv] = droplet.generateRootCa();
      const bundle: CertificateBundle = { priv, cert };
      await store.store("ca", bundle);
      ca = new CertificateAuthority(store, bundle);
    } else {
      ca = new CertificateAuthority(store, root);
    }

    const serverCertificate = await ca.fetchClientCertificate("server");
    if (!serverCertificate) {
      await ca.generateClientCertificate("server", "Drop Server");
    }

    return ca;
  }

  async generateClientCertificate(clientId: string, clientName: string) {
    const caCertificate = await this.certificateStore.fetch("ca");
    if (!caCertificate)
      throw new Error("Certificate authority not initialised");
    const [cert, priv] = droplet.generateClientCertificate(
      clientId,
      clientName,
      caCertificate.cert,
      caCertificate.priv
    );
    const certBundle: CertificateBundle = {
      priv,
      cert,
    };
    return certBundle;
  }

  async storeClientCertificate(clientId: string, bundle: CertificateBundle) {
    await this.certificateStore.store(`client:${clientId}`, bundle);
  }

  async fetchClientCertificate(clientId: string) {
    const isBlacklist = await this.certificateStore.checkBlacklistCertificate(
      clientId
    );
    if (isBlacklist) return undefined;
    return await this.certificateStore.fetch(`client:${clientId}`);
  }

  async blacklistClient(clientId: string) {
    await this.certificateStore.blacklistCertificate(clientId);
  }
}