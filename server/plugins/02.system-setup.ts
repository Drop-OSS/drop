import prisma from "../internal/db/database";

export default defineNitroPlugin(async () => {
  const userCount = await prisma.user.count({
    where: { id: { not: "system" } },
  });
  if (userCount != 0) return;

  // This setup runs every time the server sets up,
  // but has not been configured
  // so it should be in-place

  // Create admin invitation
  await prisma.invitation.upsert({
    where: {
      id: "admin",
    },
    create: {
      id: "admin",
      isAdmin: true,
      expires: new Date("4096-01-01"),
    },
    update: {
      isAdmin: true,
    },
  });
});
