import contextManager from "../internal/downloads/coordinator";

export default defineTask({
  meta: {
    name: "downloadCleanup",
  },
  async run() {
    await contextManager.cleanup();
    return { result: true };
  },
});
