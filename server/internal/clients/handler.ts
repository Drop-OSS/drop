import { randomUUID } from "node:crypto";
import prisma from "../db/database";
import type { Platform } from "~/prisma/client/enums";
import { useCertificateAuthority } from "~/server/plugins/ca";
import type {
  CapabilityConfiguration,
  InternalClientCapability,
} from "./capabilities";
import capabilityManager from "./capabilities";

export interface ClientMetadata {
  name: string;
  platform: Platform;
  capabilities: Partial<CapabilityConfiguration>;
}

export class ClientHandler {
  private temporaryClientTable = new Map<
    string,
    {
      timeout: NodeJS.Timeout;
      data: ClientMetadata;
      userId?: string;
      authToken?: string;
    }
  >();

  async initiate(metadata: ClientMetadata) {
    const clientId = randomUUID();

    this.temporaryClientTable.set(clientId, {
      data: metadata,
      timeout: setTimeout(
        () => {
          if (this.temporaryClientTable.has(clientId))
            this.temporaryClientTable.delete(clientId);
        },
        1000 * 60 * 10,
      ), // 10 minutes
    });

    return clientId;
  }

  async fetchClientMetadata(clientId: string) {
    return (await this.fetchClient(clientId))?.data;
  }

  async fetchClient(clientId: string) {
    const entry = this.temporaryClientTable.get(clientId);
    if (!entry) return undefined;
    return entry;
  }

  async attachUserId(clientId: string, userId: string) {
    const clientTable = this.temporaryClientTable.get(clientId);
    if (!clientTable) throw new Error("Invalid clientId for attaching userId");
    clientTable.userId = userId;
  }

  async generateAuthToken(clientId: string) {
    const entry = this.temporaryClientTable.get(clientId);
    if (!entry) throw new Error("Invalid clientId to generate token");

    const token = randomUUID();
    entry.authToken = token;

    return token;
  }

  async fetchClientMetadataByToken(token: string) {
    return this.temporaryClientTable
      .entries()
      .toArray()
      .map((e) => Object.assign(e[1], { id: e[0] }))
      .find((e) => e.authToken === token);
  }

  async finialiseClient(id: string) {
    const metadata = this.temporaryClientTable.get(id);
    if (!metadata) throw new Error("Invalid client ID");
    if (!metadata.userId) throw new Error("Un-authorized client ID");

    const client = await prisma.client.create({
      data: {
        id: id,
        userId: metadata.userId,

        capabilities: [],

        name: metadata.data.name,
        platform: metadata.data.platform,
        lastConnected: new Date(),
      },
    });

    for (const [capability, configuration] of Object.entries(
      metadata.data.capabilities,
    )) {
      await capabilityManager.upsertClientCapability(
        capability as InternalClientCapability,
        configuration,
        client.id,
      );
    }

    this.temporaryClientTable.delete(id);

    return client;
  }

  async removeClient(id: string) {
    const ca = useCertificateAuthority();
    await ca.blacklistClient(id);

    await prisma.client.delete({
      where: {
        id,
      },
    });
  }
}

export const clientHandler = new ClientHandler();
export default clientHandler;
