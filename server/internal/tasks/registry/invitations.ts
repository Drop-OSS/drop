import prisma from "~/server/internal/db/database";
import { defineDropTask } from "..";

export default defineDropTask({
  buildId: () => `cleanup:invitations:${new Date().toISOString()}`,
  name: "Cleanup Invitations",
  acls: ["system:maintenance:read"],
  taskGroup: "cleanup:invitations",
  async run({ log }) {
    log("Cleaning invitations");

    const now = new Date();

    await prisma.invitation.deleteMany({
      where: {
        expires: {
          lt: now,
        },
      },
    });

    log("Done");
  },
});
