import sessionHandler from "~/server/internal/session";
import { defineDropTask } from "..";

export default defineDropTask({
  buildId: () => `cleanup:sessions:${new Date().toISOString()}`,
  name: "Cleanup Sessions",
  acls: ["system:maintenance:read"],
  taskGroup: "cleanup:sessions",
  async run({ log }) {
    log("Cleaning up sessions");
    await sessionHandler.cleanupSessions();
    log("Done");
  },
});
