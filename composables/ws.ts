export type WebSocketCallback = (message: string) => void;

export class WebSocketHandler {
  private listeners: Array<WebSocketCallback> = [];
  private outQueue: Array<string> = [];
  private inQueue: Array<string> = [];
  private ws: WebSocket | undefined = undefined;
  private connected: boolean = false;

  constructor(route: string) {
    if (import.meta.server) return;
    const isSecure = location.protocol === "https:";
    const url = (isSecure ? "wss://" : "ws://") + location.host + route;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      for (const message of this.outQueue) {
        this.ws?.send(message);
      }
    };

    this.ws.onmessage = (e) => {
      const message = e.data;
      if (this.listeners.length == 0) {
        this.inQueue.push(message);
        return;
      }

      for (const listener of this.listeners) {
        listener(message);
      }
    };
  }

  listen(callback: WebSocketCallback) {
    this.listeners.push(callback);
  }

  send(message: string) {
    if (!this.connected || !this.ws) {
      this.outQueue.push(message);
      return;
    }

    this.ws.send(message);
  }
}
