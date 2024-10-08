import { v4 as uuidv4 } from "uuid";

export interface ClientMetadata {
  name: string;
  platform: string;
}

export class ClientHandler {
  private temporaryClientTable: {
    [key: string]: {
      timeout: NodeJS.Timeout;
      data: ClientMetadata;
      userId?: string;
      authToken?: string;
    };
  } = {};

  async initiate(metadata: ClientMetadata) {
    const clientId = uuidv4();

    this.temporaryClientTable[clientId] = {
      data: metadata,
      timeout: setTimeout(() => {
        if (this.temporaryClientTable[clientId])
          delete this.temporaryClientTable[clientId];
      }, 1000 * 60 * 10), // 10 minutes
    };

    return clientId;
  }

  async fetchInitiateClientMetadata(clientId: string) {
    const entry = this.temporaryClientTable[clientId];
    if (!entry) return undefined;
    return entry.data;
  }

  async attachUserId(clientId: string, userId: string) {
    if (!this.temporaryClientTable[clientId])
      throw new Error("Invalid clientId for attaching userId");
    this.temporaryClientTable[clientId].userId = userId;
  }

  async generateAuthToken(clientId: string) {
    const entry = this.temporaryClientTable[clientId];
    if (!entry) throw new Error("Invalid clientId to generate token");

    const token = uuidv4();
    this.temporaryClientTable[clientId].authToken = token;

    return token;
  }
}

export const clientHandler = new ClientHandler();
export default clientHandler;
