import { randomUUID } from "node:crypto";
import prisma from "../db/database";
import type { Platform } from "~/prisma/client/enums";
import { useCertificateAuthority } from "~/server/plugins/ca";
import type {
  CapabilityConfiguration,
  InternalClientCapability,
} from "./capabilities";
import capabilityManager from "./capabilities";
import type { PeerImpl } from "../tasks";

export enum AuthMode {
  Callback = "callback",
  Code = "code",
}

export interface ClientMetadata {
  name: string;
  platform: Platform;
  capabilities: Partial<CapabilityConfiguration>;
  mode: AuthMode;
}

export class ClientHandler {
  private temporaryClientTable = new Map<
    string,
    {
      timeout: NodeJS.Timeout;
      data: ClientMetadata;
      userId?: string;
      authToken?: string;
      peer?: PeerImpl;
    }
  >();
  private codeClientMap = new Map<string, string>();

  async initiate(metadata: ClientMetadata) {
    const clientId = randomUUID();

    this.temporaryClientTable.set(clientId, {
      data: metadata,
      timeout: setTimeout(
        () => {
          const client = this.temporaryClientTable.get(clientId);
          if (client) {
            if (client.peer) {
              client.peer.send(
                JSON.stringify({ type: "error", value: "Request timed out." }),
              );
              client.peer.close();
            }
            this.temporaryClientTable.delete(clientId);
          }

          const code = this.codeClientMap
            .entries()
            .find(([_, v]) => v === clientId);
          if (code) this.codeClientMap.delete(code[0]);
        },
        1000 * 60 * 10,
      ), // 10 minutes
    });

    switch (metadata.mode) {
      case AuthMode.Callback:
        return `/client/authorize/${clientId}`;
      case AuthMode.Code: {
        const code = randomUUID()
          .replaceAll(/-/g, "")
          .slice(0, 7)
          .toUpperCase();
        this.codeClientMap.set(code, clientId);
        return code;
      }
    }
  }

  async connectCodeListener(code: string, peer: PeerImpl) {
    const clientId = this.codeClientMap.get(code);
    if (!clientId)
      throw createError({
        statusCode: 403,
        statusMessage: "Invalid or unknown code.",
      });
    const metadata = this.temporaryClientTable.get(clientId);
    if (!metadata)
      throw createError({ statusCode: 500, statusMessage: "Broken code." });
    if (metadata.peer)
      throw createError({
        statusCode: 400,
        statusMessage: "Pre-existing listener for this code.",
      });
    metadata.peer = peer;
    this.temporaryClientTable.set(clientId, metadata);
  }

  async fetchClientIdByCode(code: string) {
    return this.codeClientMap.get(code);
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

  async sendAuthToken(clientId: string, token: string) {
    const client = this.temporaryClientTable.get(clientId);
    if (!client)
      throw createError({
        statusCode: 500,
        statusMessage: "Corrupted code, please restart the process.",
      });
    if (!client.peer)
      throw createError({
        statusCode: 400,
        statusMessage: "Client has not connected yet. Please try again later.",
      });
    await client.peer.send(
      JSON.stringify({ type: "token", value: `${clientId}/${token}` }),
    );
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
