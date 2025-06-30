class SystemConfig {
  private libraryFolder = process.env.LIBRARY ?? "./.data/library";
  private dataFolder = process.env.DATA ?? "./.data/data";

  private externalUrl = process.env.EXTERNAL_URL ?? "http://localhost:3000";
  private dropVersion;
  private gitRef;

  private checkForUpdates = getUpdateCheckConfig();

  constructor() {
    // get drop version and git ref from nuxt config
    const config = useRuntimeConfig();
    this.dropVersion = config.dropVersion;
    this.gitRef = config.gitRef;

    if (
      !this.externalUrl.startsWith("https://") &&
      !this.externalUrl.startsWith("http://")
    ) {
      console.error(
        "EXTERNAL_URL doesn't start with a http protocl, attempting fix",
      );
      this.externalUrl = "http://" + this.externalUrl;
    }
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

  getExternalUrl() {
    return this.externalUrl;
  }
}

export const systemConfig = new SystemConfig();

/**
 * Gets the configuration for checking updates based on various conditions
 * @returns true if updates should be checked, false otherwise.
 */
function getUpdateCheckConfig(): boolean {
  const envCheckUpdates = process.env.CHECK_FOR_UPDATES;

  // Check environment variable
  if (envCheckUpdates !== undefined) {
    // if explicitly set to true or false, return that value
    if (envCheckUpdates.toLocaleLowerCase() === "true") {
      return true;
    } else if (envCheckUpdates.toLocaleLowerCase() === "false") {
      return false;
    }
  } else if (process.env.NODE_ENV === "production") {
    // default to true in production
    return true;
  }

  return false;
}
