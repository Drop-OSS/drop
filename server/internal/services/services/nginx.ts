import { spawn } from "child_process";
import { Service } from "..";
import { systemConfig } from "../../config/sys-conf";
import path from "path";
import fs from "fs";

export const NGINX_SERVICE = new Service(
  "nginx",
  () => {
    const nginxConfig = path.resolve(
      process.env.NGINX_CONFIG ?? "./build/nginx.conf",
    );
    const nginxPrefix = path.join(systemConfig.getDataFolder(), "nginx");
    fs.mkdirSync(nginxPrefix, { recursive: true });

    return spawn("nginx", ["-c", nginxConfig, "-p", nginxPrefix]);
  },
  undefined,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async () => await $fetch(`http://127.0.0.1:8080/`),
);
