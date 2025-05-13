import type { HeadscaleService } from "@drop-oss/headscalez";
import { HeadscaleControlService, startHeadscale } from "@drop-oss/headscalez";
import { systemConfig } from "../config/sys-conf";
import type { Client, User } from "~/prisma/client";

export class HeadscaleManager {
  private controlURL?: string;
  private headscaleService?: HeadscaleService;
  private headscaleClient?: HeadscaleControlService;

  constructor() {
    this.setup();
  }

  async setup() {
    const externalUrl = process.env.CONTROL_URL;
    if (externalUrl) {
      this.controlURL = externalUrl;
      const headscale = await startHeadscale({
        externalUrl,
        dir: systemConfig.getHeadscaleFolder(),
      });
      this.headscaleService = headscale;
      this.headscaleClient = new HeadscaleControlService(headscale);
    }
  }

  enabled() {
    return !!this.headscaleService;
  }

  configuration() {
    if (!this.controlURL) throw new Error("Headscale not available");
    return {
      controlURL: this.controlURL,
    };
  }

  private async fetchUser(user: User) {
    if (!this.headscaleClient)
      throw new Error("Headscale client not available");
    const { response } = await this.headscaleClient.client.listUsers({
      id: 0n,
      name: user.id,
      email: "",
    });

    if (response.users.length == 0) {
      const { response } = await this.headscaleClient.client.createUser({
        name: user.id,
        displayName: user.displayName,
        email: user.email,
        pictureUrl: user.profilePictureObjectId,
      });

      if (!response.user) throw new Error("Could not create user");

      return response.user;
    }

    return response.users[0];
  }

  async createPreauthKey(user: User, client: Client) {
    if (!this.headscaleClient)
      throw new Error("Headscale client not available");

    const headscaleUser = await this.fetchUser(user);
    const { response } = await this.headscaleClient.client.createPreAuthKey({
      user: headscaleUser.name,
      reusable: false,
      ephemeral: false,
      aclTags: ["client", `user:${user.id}`, `client:${client.id}`],
    });

    if (!response.preAuthKey) throw new Error("Could not create pre-auth key");
    return response.preAuthKey;
  }
}

export const headscaleManager = new HeadscaleManager();
export default headscaleManager;
