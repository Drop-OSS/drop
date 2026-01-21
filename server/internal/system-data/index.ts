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

    setInterval(() => this.pushUpdate(userId, id), 10000);
  }

  unlisten(userId: string, id: string) {
    this.listeners.get(userId)?.delete(id);
  }

  private async pushUpdate(userId: string, id: string) {
    const listener = this.listeners.get(userId)?.get(id);
    if (!listener) {
      throw new Error("Failed to catch-up listener: callback does not exist");
    }
    listener.callback(this.getSystemData());
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
