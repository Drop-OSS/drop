/*
The notification system handles the receiving, creation and sending of notifications in Drop

Design goals:
1. Nonce-based notifications; notifications should only be created once
2. Real-time; use websocket listeners to keep clients up-to-date
*/

import os from "os";
import type { GlobalACL } from "../acls";

// type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type SystemData = {
  totalRam: number;
  freeRam: number;
  cpuLoad: number;
  cpuCores: number;
};

export type SystemDataCreateArgs = SystemData & { acls: Array<GlobalACL> };

class SystemManager {
  // userId to acl to listenerId
  private listeners = new Map<
    string,
    Map<
      string,
      { callback: (systemData: SystemData) => void; acls: GlobalACL[] }
    >
  >();

  listen(
    userId: string,
    acls: Array<GlobalACL>,
    id: string,
    callback: (systemData: SystemData) => void,
  ) {
    if (!this.listeners.has(userId)) this.listeners.set(userId, new Map());
    // eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion
    this.listeners.get(userId)!!.set(id, { callback, acls });

    this.catchupListener(userId, id);
  }

  unlisten(userId: string, id: string) {
    this.listeners.get(userId)?.delete(id);
  }

  private async catchupListener(userId: string, id: string) {
    console.log("catchupListener");
    const listener = this.listeners.get(userId)?.get(id);
    if (!listener) {
      console.log("===========================================");
      console.log("userId: ", userId);
      console.log("id: ", id);
      console.log("listers: ", this.listeners);
      throw new Error("Failed to catch-up listener: callback does not exist");
    }
    listener.callback(this.getSystemData());
    setTimeout(() => this.catchupListener(userId, id), 10000);
  }

  getSystemData(): SystemData {
    return {
      cpuLoad: this.cpuLoad(),
      totalRam: os.totalmem(),
      freeRam: os.freemem(),
      cpuCores: os.cpus().length,
    };
  }

  private cpuLoad() {
    const [oneMinLoad, _fiveMinLoad, _fiftenMinLoad] = os.loadavg();
    const numberCpus = os.cpus().length;
    return 100 - ((numberCpus - oneMinLoad) / numberCpus) * 100;
  }
}

export const systemManager = new SystemManager();
export default systemManager;
