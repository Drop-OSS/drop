class SystemConfig {
  private libraryFolder = process.env.LIBRARY ?? "./.data/library";
  private dataFolder = process.env.DATA ?? "./.data/data";

  private dropVersion;
  private gitRef;

  private checkForUpdates =
    process.env.CHECK_FOR_UPDATES !== undefined &&
    process.env.CHECK_FOR_UPDATES.toLocaleLowerCase() === "true"
      ? true
      : false;

  constructor() {
    // get drop version and git ref from nuxt config
    const config = useRuntimeConfig();
    this.dropVersion = config.dropVersion;
    this.gitRef = config.gitRef;
  }

  getLibraryFolder() {
    return this.libraryFolder;
  }

  getDataFolder() {
    return this.dataFolder;
  }

  getDropVersion() {
    return this.dropVersion;
  }

  getGitRef() {
    return this.gitRef;
  }

  shouldCheckForUpdates() {
    return this.checkForUpdates;
  }
}

export const systemConfig = new SystemConfig();
