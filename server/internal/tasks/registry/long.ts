import { defineDropTask } from "..";

export default defineDropTask({
  buildId: () => `long:${new Date().toISOString()}`,
  taskGroup: "debug",
  name: "LONGGGG",
  acls: [],
  async run({ log, progress }) {
    const minutes = 15;
    const seconds = minutes * 60;
    let currentProgress = 0;
    const increment = 1 / seconds;

    for (let i = 0; i < seconds; i++) {
      progress(currentProgress);
      log(`LONGGG: ${currentProgress}`);
      currentProgress += increment;
      await new Promise<void>((r) => setTimeout(r, 1000));
    }
  },
});
