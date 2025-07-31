import { APITokenMode } from "~/prisma/client/enums";
import prisma from "~/server/internal/db/database";
import { systemConfig } from "../internal/config/sys-conf";
import { logger } from "../internal/logging";

export default defineNitroPlugin(async (_nitro) => {
  await prisma.aPIToken.deleteMany({
    where: {
      acls: {
        hasSome: ["setup"],
      },
      mode: APITokenMode.System,
    },
  });

  const userCount = await prisma.user.count({
    where: { id: { not: "system" } },
  });
  if (userCount != 0) return;

  // This setup runs every time the server sets up,
  // but has not been configured
  // so it should be in-place

  const token = await prisma.aPIToken.create({
    data: {
      name: "Setup Wizard",
      mode: APITokenMode.System,
      acls: ["setup"],
    },
  });

  const setupUrl = `${systemConfig.getExternalUrl()}/setup?token=${token.token}`;
  logger.info(`Open ${setupUrl} in a browser to get started with Drop.`);
});
