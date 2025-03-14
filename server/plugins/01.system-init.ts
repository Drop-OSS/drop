import { applicationSettings } from "../internal/config/application-configuration";
import prisma from "../internal/db/database";

export default defineNitroPlugin(async (nitro) => {
  // Ensure system user exists
  // The system user owns any user-based code
  // that we want to re-use for the app
  // e.g. notifications
  await prisma.user.upsert({
    where: {
      id: "system",
    },
    create: {
      id: "system",
      admin: true,

      displayName: "System",
      username: "system",
      email: "system@drop",
      profilePicture: "",
    },
    update: {
      admin: true,
      authMecs: { set: [] },
      clients: { set: [] },
    },
  });
});
