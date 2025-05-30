import { configure } from "arktype/config";

export const throwingArktype = configure({
  onFail: (errors) => errors.throw(),
  actual: () => ""
});

// be sure to specify both the runtime and static configs

declare global {
  interface ArkEnv {
    onFail: typeof throwingArktype.onFail;
  }
}
