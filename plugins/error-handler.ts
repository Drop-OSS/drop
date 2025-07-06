import { logger } from "~/server/internal/logging";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("vue:error", (error, instance, info) => {
    logger.error(info, error, instance);
  });
});
