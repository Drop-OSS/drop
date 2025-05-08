import type { EnumDictionary } from "../utils/types";
import https from "https";
import { useCertificateAuthority } from "~/server/plugins/ca";
import prisma from "../db/database";
import { ClientCapabilities } from "~/prisma/client";

// These values are technically mapped to the database,
// but Typescript/Prisma doesn't let me link them
// They are also what are required by clients in the API
// BREAKING CHANGE
export enum InternalClientCapability {
  PeerAPI = "peerAPI",
  UserStatus = "userStatus",
  CloudSaves = "cloudSaves",
}

export const validCapabilities = Object.values(InternalClientCapability);

export type CapabilityConfiguration = {
  [InternalClientCapability.PeerAPI]: { endpoints: string[] };
  [InternalClientCapability.UserStatus]: object;
  [InternalClientCapability.CloudSaves]: object;
};

class CapabilityManager {
  private validationFunctions: EnumDictionary<
    InternalClientCapability,
    (configuration: object) => Promise<boolean>
  > = {
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
          /* empty */
        }
      }

      return valid;
    },
    [InternalClientCapability.UserStatus]: async () => true, // No requirements for user status
    [InternalClientCapability.CloudSaves]: async () => true, // No requirements for cloud saves
  };

  async validateCapabilityConfiguration(
    capability: InternalClientCapability,
    configuration: object,
  ) {
    const validationFunction = this.validationFunctions[capability];
    if (!validationFunction) return false;
    return validationFunction(configuration);
  }

  async upsertClientCapability(
    capability: InternalClientCapability,
    rawCapability: object,
    clientId: string,
  ) {
    const upsertFunctions: EnumDictionary<
      InternalClientCapability,
      () => Promise<void> | void
    > = {
      [InternalClientCapability.PeerAPI]: async function () {
        const configuration =
          rawCapability as CapabilityConfiguration[InternalClientCapability.PeerAPI];

        const currentClient = await prisma.client.findUnique({
          where: { id: clientId },
          select: {
            capabilities: true,
          },
        });
        if (!currentClient) throw new Error("Invalid client ID");
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

        await prisma.client.update({
          where: { id: clientId },
          data: {
            capabilities: {
              push: ClientCapabilities.PeerAPI,
            },
          },
        });
      },
      [InternalClientCapability.UserStatus]: function (): Promise<void> | void {
        throw new Error("Function not implemented.");
      },
      [InternalClientCapability.CloudSaves]: async function () {
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
    };
    await upsertFunctions[capability]();
  }
}

const capabilityManager = new CapabilityManager();
export default capabilityManager;
