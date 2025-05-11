import path from "path";

class SystemConfig {
  private libraryFolder = process.env.LIBRARY ?? "./.data/library";
  private dataFolder = process.env.DATA ?? "./.data/data";
  private headscaleFolder = path.join(this.dataFolder, "headscale");

  getLibraryFolder() {
    return this.libraryFolder;
  }

  getDataFolder() {
    return this.dataFolder;
  }

  getHeadscaleFolder() {
    return this.headscaleFolder;
  }
}

export const systemConfig = new SystemConfig();
