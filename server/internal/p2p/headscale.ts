import type { HeadscaleService} from "@drop-oss/headscalez";
import { startHeadscale } from "@drop-oss/headscalez";

export class HeadscaleManager {
  private headscaleService?: HeadscaleService;

  constructor() {
    this.setup();
  }

  async setup() {
    const externalUrl = process.env.CONTROL_URL;
    if (externalUrl) {
      const headscale = await startHeadscale({ externalUrl });
      this.headscaleService = headscale;
    }
  }

  enabled() {
    return !!this.headscaleService;
  }
}

export const headscaleManager = new HeadscaleManager();
export default headscaleManager;
