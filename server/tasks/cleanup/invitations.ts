import prisma from "~/server/internal/db/database";

export default defineTask({
  meta: {
    name: "cleanup:invitations",
  },
  async run() {
    const now = new Date();

    await prisma.invitation.deleteMany({
      where: {
        expires: {
          lt: now,
        },
      },
    });

    return { result: true };
  },
});
