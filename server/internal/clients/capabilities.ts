import type { EnumDictionary } from "../utils/types";
import prisma from "../db/database";
import { ClientCapabilities } from "~~/prisma/client/enums";


export const validCapabilities = Object.values(ClientCapabilities);

export type CapabilityConfiguration = {
  [ClientCapabilities.PeerAPI]: object;
  [ClientCapabilities.UserStatus]: object;
  [ClientCapabilities.CloudSaves]: object;
};

class CapabilityManager {
  private validationFunctions: EnumDictionary<
    ClientCapabilities,
    (configuration: object) => Promise<boolean>
  > = {
    /*
    [InternalClientCapability.PeerAPI]: async (rawConfiguration) => {
      const configuration =
        rawConfiguration as CapabilityConfiguration[InternalClientCapability.PeerAPI];

      // Check if we can use the endpoints object
      if (!configuration.endpoints) return false;
      if (!Array.isArray(configuration.endpoints)) return false;
      if (configuration.endpoints.length == 0) return false;

      // Check if valid URLs
      if (
        configuration.endpoints.filter((endpoint) => {
          try {
            new URL(endpoint);
            return true;
          } catch {
            return false;
          }
        })
      )
        return false;

      const ca = useCertificateAuthority();
      const serverCertificate = await ca.fetchClientCertificate("server");
      if (!serverCertificate)
        throw new Error(
          "CA not initialised properly - server mTLS certificate not present",
        );
      const httpsAgent = new https.Agent({
        key: serverCertificate.priv,
        cert: serverCertificate.cert,
      });

      // Loop through endpoints and make sure at least one is accessible by the Drop server
      let valid = false;
      for (const endpoint of configuration.endpoints) {
        const healthcheckEndpoint = new URL("/", endpoint);
        try {
          await $fetch(healthcheckEndpoint.href, {
            agent: httpsAgent,
          });
          valid = true;
          break;
        } catch {
        }
      }

      return valid;
    },
    */
    [ClientCapabilities.PeerAPI]: async () => true,
    [ClientCapabilities.UserStatus]: async () => true, // No requirements for user status
    [ClientCapabilities.CloudSaves]: async () => true, // No requirements for cloud saves
    [ClientCapabilities.TrackPlaytime]: async () => true,
  };

  async validateCapabilityConfiguration(
    capability: ClientCapabilities,
    configuration: object,
  ) {
    const validationFunction = this.validationFunctions[capability];
    if (!validationFunction) return false;
    return validationFunction(configuration);
  }

  async upsertClientCapability(
    capability: ClientCapabilities,
    rawCapabilityConfiguration: object,
    clientId: string,
  ) {
    const upsertFunctions: EnumDictionary<
      ClientCapabilities,
      () => Promise<void> | void
    > = {
      [ClientCapabilities.PeerAPI]: async function () {
        // const configuration =rawCapability as CapabilityConfiguration[InternalClientCapability.PeerAPI];

        const currentClient = await prisma.client.findUnique({
          where: { id: clientId },
          select: {
            capabilities: true,
          },
        });
        if (!currentClient) throw new Error("Invalid client ID");
        /*
        if (currentClient.capabilities.includes(ClientCapabilities.PeerAPI)) {
          await prisma.clientPeerAPIConfiguration.update({
            where: { clientId },
            data: {
              endpoints: configuration.endpoints,
            },
          });
          return;
        }

        await prisma.clientPeerAPIConfiguration.create({
          data: {
            clientId: clientId,
            endpoints: configuration.endpoints,
          },
        });
        */

        await prisma.client.update({
          where: { id: clientId },
          data: {
            capabilities: {
              push: ClientCapabilities.PeerAPI,
            },
          },
        });
      },
      [ClientCapabilities.UserStatus]: function (): Promise<void> | void {
        throw new Error("Function not implemented.");
      },
      [ClientCapabilities.CloudSaves]: async function () {
        const currentClient = await prisma.client.findUnique({
          where: { id: clientId },
          select: {
            capabilities: true,
          },
        });
        if (!currentClient) throw new Error("Invalid client ID");
        if (currentClient.capabilities.includes(ClientCapabilities.CloudSaves))
          return;

        await prisma.client.update({
          where: { id: clientId },
          data: {
            capabilities: {
              push: ClientCapabilities.CloudSaves,
            },
          },
        });
      },
      [ClientCapabilities.TrackPlaytime]: async function () {
        const currentClient = await prisma.client.findUnique({
          where: { id: clientId },
          select: {
            capabilities: true,
          },
        });
        if (!currentClient) throw new Error("Invalid client ID");
        if (
          currentClient.capabilities.includes(ClientCapabilities.TrackPlaytime)
        )
          return;

        await prisma.client.update({
          where: { id: clientId },
          data: {
            capabilities: {
              push: ClientCapabilities.TrackPlaytime,
            },
          },
        });
      },
    };
    await upsertFunctions[capability]();
  }
}

const capabilityManager = new CapabilityManager();
export default capabilityManager;
