import sessionHandler from "~/server/internal/session";

export default defineTask({
  meta: {
    name: "cleanup:sessions",
  },
  async run() {
    console.log("[Task cleanup:sessions]: Cleaning up sessions");
    await sessionHandler.cleanupSessions();
    console.log("[Task cleanup:sessions]: Done");
    return { result: true };
  },
});
