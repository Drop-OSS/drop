import prisma from "~/server/internal/db/database";

export default defineTask({
  meta: {
    name: "cleanup:invitations",
  },
  async run() {
    console.log("[Task cleanup:invitations]: Cleaning invitations");

    const now = new Date();

    await prisma.invitation.deleteMany({
      where: {
        expires: {
          lt: now,
        },
      },
    });

    console.log("[Task cleanup:invitations]: Done");
    return { result: true };
  },
});
