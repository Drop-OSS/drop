import { ApplicationSettings, AuthMec } from "@prisma/client";
import prisma from "../db/database";

class ApplicationConfiguration {
  // Reference to the currently selected application configuration
  private currentApplicationSettings: ApplicationSettings | undefined =
    undefined;

  private async save() {
    await this.init();

    const deepAppConfigCopy: Omit<ApplicationSettings, "timestamp"> & {
      timestamp?: Date;
    } = JSON.parse(JSON.stringify(this.currentApplicationSettings));

    delete deepAppConfigCopy["timestamp"];

    await prisma.applicationSettings.create({
      data: deepAppConfigCopy,
    });
  }

  private async init() {
    if (this.currentApplicationSettings === undefined) {
      const applicationSettingsCount = await prisma.applicationSettings.count(
        {}
      );
      if (applicationSettingsCount > 0) {
        await applicationSettings.pullConfiguration();
      } else {
        await applicationSettings.initialiseConfiguration();
      }
    }
  }

  // Default application configuration
  async initialiseConfiguration() {
    const initialState = await prisma.applicationSettings.create({
      data: {
        enabledAuthencationMechanisms: [AuthMec.Simple],
        metadataProviders: [],
      },
    });

    this.currentApplicationSettings = initialState;
  }

  async pullConfiguration() {
    const latestState = await prisma.applicationSettings.findFirst({
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!latestState) throw new Error("No application configuration to pull");

    this.currentApplicationSettings = latestState;
  }

  async set<T extends keyof ApplicationSettings>(
    key: T,
    value: ApplicationSettings[T]
  ) {
    await this.init();
    if (!this.currentApplicationSettings)
      throw new Error("Somehow, failed to initialise application settings");

    if (this.currentApplicationSettings[key] !== value) {
      this.currentApplicationSettings[key] = value;

      await this.save();
    }
  }

  async get<T extends keyof ApplicationSettings>(key: T): Promise<ApplicationSettings[T]> {
    await this.init();
    if (!this.currentApplicationSettings)
      throw new Error("Somehow, failed to initialise application settings");

    return this.currentApplicationSettings[key];
  }
}

export const applicationSettings = new ApplicationConfiguration();
