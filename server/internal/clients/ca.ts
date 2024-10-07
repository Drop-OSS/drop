import path from "path";
import droplet from "@drop/droplet";
import { CertificateStore } from "./store";

export type CertificateBundle = {
  priv: string;
  pub: string;
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
      const [priv, pub, cert] = droplet.generateRootCa();
      const bundle: CertificateBundle = { priv, pub, cert };
      await store.store("ca", bundle);
      return new CertificateAuthority(store, bundle);
    }
    return new CertificateAuthority(store, root);
  }
}
