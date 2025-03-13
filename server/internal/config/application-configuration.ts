import { ApplicationSettings, AuthMec } from "@prisma/client";
import prisma from "../db/database";

class ApplicationConfiguration {
  // Reference to the currently selected application configuration
  private currentApplicationSettings: ApplicationSettings = {
    timestamp: new Date(),
    enabledAuthencationMechanisms: [],
    metadataProviders: [],
  };
  private applicationStateProxy: object;
  private dirty: boolean = false;
  private dirtyPromise: Promise<any> | undefined = undefined;

  constructor() {
    this.applicationStateProxy = {};
  }

  private async save() {
    const deepAppConfigCopy: Omit<ApplicationSettings, "timestamp"> & {
      timestamp?: Date;
    } = JSON.parse(JSON.stringify(this.currentApplicationSettings));

    delete deepAppConfigCopy["timestamp"];

    await prisma.applicationSettings.create({
      data: deepAppConfigCopy,
    });
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
    if (this.currentApplicationSettings[key] !== value) {
      this.currentApplicationSettings[key] = value;

      await this.save();
    }
  }

  get<T extends keyof ApplicationSettings>(key: T): ApplicationSettings[T] {
    return this.currentApplicationSettings[key];
  }
}

export const applicationSettings = new ApplicationConfiguration();
