import { defineDropTask } from "..";

export default defineDropTask({
  buildId: () => `debug:${new Date().toISOString()}`,
  name: "Debug Task",
  acls: ["system:maintenance:read"],
  taskGroup: "debug",
  async run({ progress, logger }) {
    const amount = 1000;
    for (let i = 0; i < amount; i++) {
      progress((i / amount) * 100);
      logger.info(`dajksdkajd ${i}`);
      logger.warn("warning");
      logger.error("error\nmultiline and stuff\nwoah more lines");
      await new Promise((r) => setTimeout(r, 1500));
    }
  },
});
