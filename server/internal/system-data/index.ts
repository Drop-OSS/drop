import os from "os";

export type SystemData = {
  totalRam: number;
  freeRam: number;
  cpuLoad: number;
  cpuCores: number;
};

// See https://github.com/oscmejia/os-utils/blob/master/lib/osutils.js
function getCPUInfo() {
  const cpus = os.cpus();

  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (const cpu in cpus) {
    if (!Object.prototype.hasOwnProperty.call(cpus, cpu)) continue;
    user += cpus[cpu].times.user;
    nice += cpus[cpu].times.nice;
    sys += cpus[cpu].times.sys;
    irq += cpus[cpu].times.irq;
    idle += cpus[cpu].times.idle;
  }

  const total = user + nice + sys + idle + irq;

  return {
    idle: idle,
    total: total,
  };
}

class SystemManager {
  // userId to acl to listenerId
  private listeners = new Map<
    string,
    Map<string, { callback: (systemData: SystemData) => void }>
  >();

  private lastCPUUpdate: { idle: number; total: number } | undefined;

  constructor() {
    setInterval(() => {
      const systemData = this.getSystemData();
      if (!systemData) return;
      for (const [, map] of this.listeners.entries()) {
        for (const [, { callback }] of map.entries()) {
          callback(systemData);
        }
      }
    }, 3000);
  }

  listen(
    userId: string,
    id: string,
    callback: (systemData: SystemData) => void,
  ) {
    if (!this.listeners.has(userId)) this.listeners.set(userId, new Map());
    // eslint-disable-next-line @typescript-eslint/no-extra-non-null-assertion
    this.listeners.get(userId)!!.set(id, { callback });
  }

  unlisten(userId: string, id: string) {
    this.listeners.get(userId)?.delete(id);
  }

  getSystemData(): SystemData | undefined {
    const cpu = this.cpuLoad();
    if (!cpu) return undefined;
    return {
      cpuLoad: cpu * 100,
      totalRam: os.totalmem(),
      freeRam: os.freemem(),
      cpuCores: os.cpus().length,
    };
  }

  private cpuLoad() {
    const last = this.lastCPUUpdate;
    this.lastCPUUpdate = getCPUInfo();
    if (!last) return undefined;

    const idle = this.lastCPUUpdate.idle - last.idle;
    const total = this.lastCPUUpdate.total - last.total;

    const perc = idle / total;
    return 1 - perc;
  }
}

export const systemManager = new SystemManager();
export default systemManager;
