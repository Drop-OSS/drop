import serviceManager from "../internal/services";
import { NGINX_SERVICE } from "../internal/services/services/nginx";
import { TORRENTIAL_SERVICE } from "../internal/services/torrential";

export default defineNitroPlugin(async (nitro) => {
  TORRENTIAL_SERVICE.register();
  NGINX_SERVICE.register();

  serviceManager.spin();

  nitro.hooks.hookOnce("close", async () => {
    serviceManager.kill();
  });
});
