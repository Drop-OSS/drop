import sessionHandler from "~/server/internal/session";
import { defineDropTask } from "..";

export default defineDropTask({
  buildId: () => `cleanup:sessions:${new Date().toISOString()}`,
  name: "Cleanup Sessions",
  acls: ["system:maintenance:read"],
  taskGroup: "cleanup:sessions",
  async run({ logger }) {
    logger.info("Cleaning up sessions");
    await sessionHandler.cleanupSessions();
    logger.info("Done");
  },
});
