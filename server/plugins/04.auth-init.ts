import { AuthMec } from "~/prisma/client";
import { OIDCManager } from "../internal/oidc";

export const enabledAuthManagers: {
  [AuthMec.Simple]: boolean;
  [AuthMec.OpenID]: OIDCManager | undefined;
} = {
  [AuthMec.Simple]: false,
  [AuthMec.OpenID]: undefined,
};

const initFunctions: {
  [K in keyof typeof enabledAuthManagers]: () => Promise<unknown>;
} = {
  [AuthMec.OpenID]: OIDCManager.prototype.create,
  [AuthMec.Simple]: async () => {
    const disabled = process.env.DISABLE_SIMPLE_AUTH as string | undefined;
    return !disabled;
  },
};

export default defineNitroPlugin(async () => {
  for (const [key, init] of Object.entries(initFunctions)) {
    try {
      const object = await init();
      if (!object) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (enabledAuthManagers as any)[key] = object;
      console.log(`enabled auth: ${key}`);
    } catch (e) {
      console.warn(e);
    }
  }

  // Add every other auth mechanism here, and fall back to simple if none of them are enabled
  if (!enabledAuthManagers[AuthMec.OpenID]) {
    enabledAuthManagers[AuthMec.Simple] = true;
  }
});
