import { ApplicationSettings, AuthMec } from "@prisma/client";
import prisma from "../db/database";

class ApplicationConfiguration {
  // Reference to the currently selected application configuration
  private currentApplicationSettings: ApplicationSettings;
  private applicationStateProxy: object;
  private dirty: boolean = false;
  private dirtyPromise: Promise<any> | undefined = undefined;

  constructor() {
    // @ts-expect-error
    this.currentApplicationSettings = {};
    this.applicationStateProxy = {};
  }

  private buildApplicationSettingsProxy() {
    const appConfig = this;
    const proxy = new Proxy(this.currentApplicationSettings, {
      get: (target, key: keyof ApplicationSettings) => {
        return appConfig.currentApplicationSettings[key];
      },
      set: (target, key: keyof ApplicationSettings, value) => {
        if (JSON.stringify(value) === JSON.stringify(appConfig.currentApplicationSettings[key])) return true;
        appConfig.currentApplicationSettings[key] = value;

        const deepAppConfigCopy: Omit<ApplicationSettings, "timestamp"> & {
          timestamp?: Date;
        } = JSON.parse(JSON.stringify(appConfig.currentApplicationSettings));

        delete deepAppConfigCopy["timestamp"];

        appConfig.dirty = true;
        appConfig.dirtyPromise = prisma.applicationSettings.create({
          data: deepAppConfigCopy,
        });
        return true;
      },
      deleteProperty: (target, key: keyof ApplicationSettings) => {
        return false;
      },
    });
    this.applicationStateProxy = proxy;
  }

  // Default application configuration
  async initialiseConfiguration() {
    const initialState = await prisma.applicationSettings.create({
      data: {
        enabledAuthencationMechanisms: [AuthMec.Simple],
      },
    });

    console.log("created configuration");

    this.currentApplicationSettings = initialState;
    this.buildApplicationSettingsProxy();
  }

  async pullConfiguration() {
    const latestState = await prisma.applicationSettings.findFirst({
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!latestState) throw new Error("No application configuration to pull");

    this.currentApplicationSettings = latestState;
    this.buildApplicationSettingsProxy();
    console.log("pulled configuration");
  }

  async waitForWrite() {
    if (this.dirty) {
      await this.dirtyPromise;
    }
  }

  useApplicationConfiguration(): ApplicationSettings {
    return this.applicationStateProxy as ApplicationSettings;
  }
}

export const applicationSettings = new ApplicationConfiguration();