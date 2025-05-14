class SystemConfig {
  private libraryFolder = process.env.LIBRARY ?? "./.data/library";
  private dataFolder = process.env.DATA ?? "./.data/data";
  private dropVersion = "v0.3.0";
  private checkForUpdates =
    process.env.CHECK_FOR_UPDATES !== undefined &&
    process.env.CHECK_FOR_UPDATES.toLocaleLowerCase() === "true"
      ? true
      : false;

  getLibraryFolder() {
    return this.libraryFolder;
  }

  getDataFolder() {
    return this.dataFolder;
  }

  getDropVersion() {
    return this.dropVersion;
  }

  shouldCheckForUpdates() {
    return this.checkForUpdates;
  }
}

export const systemConfig = new SystemConfig();
