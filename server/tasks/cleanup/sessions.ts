import sessionHandler from "~/server/internal/session";

export default defineTask({
  meta: {
    name: "cleanup:invitations",
  },
  async run() {
    await sessionHandler.cleanupSessions();

    return { result: true };
  },
});
