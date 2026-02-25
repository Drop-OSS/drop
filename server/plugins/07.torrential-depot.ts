import { systemConfig } from "../internal/config/sys-conf";
import prisma from "../internal/db/database";

export default defineNitroPlugin(async () => {
  const torrentialUrl = `${systemConfig.getExternalUrl()}/api/v1/depot/`;

  await prisma.depot.upsert({
    where: {
      id: "torrential",
    },
    update: {
      endpoint: torrentialUrl,
    },
    create: {
      id: "torrential",
      endpoint: torrentialUrl,
    },
  });
});
