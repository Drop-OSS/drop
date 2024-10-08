import { v4 as uuidv4 } from "uuid";

export interface ClientMetadata {
  name: string;
  platform: string;
}

export class ClientHandler {
  private temporaryClientTable: {
    [key: string]: { timeout: NodeJS.Timeout; data: ClientMetadata };
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
}

export const clientHandler = new ClientHandler();
export default clientHandler;
