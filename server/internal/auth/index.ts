import { AuthMec } from "~/prisma/client";
import { OIDCManager } from "../oidc";

class AuthManager {
  private authProviders: {
    [AuthMec.Simple]: boolean;
    [AuthMec.OpenID]: OIDCManager | undefined;
  } = {
    [AuthMec.Simple]: false,
    [AuthMec.OpenID]: undefined,
  };

  private initFuncs: {
    [K in keyof typeof this.authProviders]: () => Promise<unknown>;
  } = {
    [AuthMec.OpenID]: OIDCManager.prototype.create,
    [AuthMec.Simple]: async () => {
      const disabled = process.env.DISABLE_SIMPLE_AUTH as string | undefined;
      return !disabled;
    },
  };

  constructor() {
    console.log("AuthManager initialized");
  }

  async init() {
    for (const [key, init] of Object.entries(this.initFuncs)) {
      try {
        const object = await init();
        if (!object) break;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.authProviders as any)[key] = object;
        console.log(`enabled auth: ${key}`);
      } catch (e) {
        console.warn(e);
      }
    }

    // Add every other auth mechanism here, and fall back to simple if none of them are enabled
    if (!this.authProviders[AuthMec.OpenID]) {
      this.authProviders[AuthMec.Simple] = true;
    }
  }

  getAuthProviders() {
    return this.authProviders;
  }

  getEnabledAuthProviders() {
    const authManagers = Object.entries(this.authProviders)
      .filter((e) => !!e[1])
      .map((e) => e[0]);

    return authManagers;
  }
}

const authManager = new AuthManager();
export default authManager;

export * from "./passwordHash";
