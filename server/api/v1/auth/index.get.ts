import { enabledAuthManagers } from "~/server/plugins/04.auth-init";

export default defineEventHandler((h3) => {
  const authManagers = Object.entries(enabledAuthManagers)
    .filter((e) => !!e[1])
    .map((e) => e[0]);

  return authManagers;
});
