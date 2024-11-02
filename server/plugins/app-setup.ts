import {
  applicationSettings,
} from "../internal/config/application-configuration";
import prisma from "../internal/db/database";

export default defineNitroPlugin(async (nitro) => {
  const applicationSettingsCount = await prisma.applicationSettings.count({});
  if (applicationSettingsCount > 0) {
    await applicationSettings.pullConfiguration();
  } else {
    await applicationSettings.initialiseConfiguration();
  }

  nitro.hooks.hookOnce("close", async () => {
    await applicationSettings.waitForWrite();
  });
});
