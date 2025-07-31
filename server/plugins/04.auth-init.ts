import authManager from "~/server/internal/auth";

export default defineNitroPlugin(async () => {
  await authManager.init();
});
