import path from "path";
import droplet from "@drop/droplet";
import { CertificateStore } from "./ca-store";

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
    if (root === undefined) {
      const [cert, priv] = droplet.generateRootCa();
      const bundle: CertificateBundle = { priv, cert };
      await store.store("ca", bundle);
      return new CertificateAuthority(store, bundle);
    }
    return new CertificateAuthority(store, root);
  }

  async generateClientCertificate(clientId: string, clientName: string) {
    const caCertificate = await this.certificateStore.fetch("ca");
    if (!caCertificate)
      throw new Error("Certificate authority not initialised");
    const [cert, priv] = droplet.generateClientCertificate(
      clientId,
      clientName,
      caCertificate.cert,
      caCertificate.priv,
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
    const isBlacklist =
      await this.certificateStore.checkBlacklistCertificate(clientId);
    if (isBlacklist) return undefined;
    return await this.certificateStore.fetch(`client:${clientId}`);
  }

  async blacklistClient(clientId: string) {
    await this.certificateStore.blacklistCertificate(clientId);
  }
}
