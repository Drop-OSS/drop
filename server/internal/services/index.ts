import type { ChildProcess } from "child_process";
import { logger } from "../logging";
import type { Logger } from "pino";

class ServiceManager {
  private services: Map<string, Service<unknown>> = new Map();

  register(name: string, service: Service<unknown>) {
    this.services.set(name, service);
  }

  spin() {
    for (const service of this.services.values()) {
      service.spin();
    }
  }

  kill() {
    for (const service of this.services.values()) {
      service.kill();
    }
  }

  healthchecks() {
    return this.services
      .entries()
      .map(([name, service]) => ({ name, healthy: service.serviceHealthy() }))
      .toArray();
  }
}

export type Executor = () => ChildProcess;
export type Setup = () => Promise<boolean>;
export type Healthcheck = () => Promise<boolean>;
export class Service<T> {
  name: string;
  private executor: Executor;
  private setup: Setup | undefined;
  private healthcheck: Healthcheck | undefined;

  logger: Logger<never>;

  private currentProcess: ChildProcess | undefined;

  private runningHealthcheck: boolean = false;
  private healthy: boolean = true;
  private spun: boolean = false;

  private uutils: T;

  constructor(
    name: string,
    executor: Executor,
    setup?: Setup,
    healthcheck?: Healthcheck,
    utils?: T,
  ) {
    this.name = name;
    const serviceLogger = logger.child({ name: `service-${name}` });
    this.logger = serviceLogger;
    this.executor = executor;
    this.setup = setup;
    this.healthcheck = healthcheck;
    this.uutils = utils!;
  }

  spin() {
    if (this.spun) return;
    this.launch();

    if (this.healthcheck) {
      setInterval(this.runHealthcheck, 1000 * 60 * 5); // Every 5 minutes
    }

    this.spun = true;
  }

  kill() {
    this.spun = false;
    this.currentProcess?.kill();
  }

  register() {
    serviceManager.register(this.name, this);
  }

  private async launch() {
    if (this.currentProcess) return;
    const disableEnv = `EXTERNAL_SERVICE_${this.name.toUpperCase()}`;
    if (!process.env[disableEnv]) {
      const serviceProcess = this.executor();
      this.logger.info("service launched");

      serviceProcess.on("close", async (code, signal) => {
        serviceProcess.kill();
        this.currentProcess = undefined;
        this.logger.warn(
          `service exited with code ${code} (${signal}), restarting...`,
        );
        await new Promise((r) => setTimeout(r, 5000));
        if (this.spun) this.launch();
      });

      serviceProcess.stdout?.on("data", (data) =>
        this.logger.info(data.toString().trim()),
      );

      serviceProcess.stderr?.on("data", (data) =>
        this.logger.error(data.toString().trim()),
      );

      this.currentProcess = serviceProcess;
    }

    if (this.setup) {
      while (true) {
        try {
          const hasSetup = await this.setup();
          if (hasSetup) break;
          throw "setup function returned false...";
        } catch (e) {
          this.logger.warn(`failed setup, trying again... | ${e}`);
          await new Promise((r) => setTimeout(r, 7000));
        }
      }
      this.healthy = true;
    }
  }

  private async runHealthcheck() {
    if (!this.healthcheck || !this.currentProcess || this.runningHealthcheck)
      return;
    this.runningHealthcheck = true;
    let fails = 0;

    while (true) {
      try {
        const successful = await this.healthcheck();
        if (successful) break;
      } finally {
        /* empty */
      }
      this.healthy = false;
      fails++;
      if (fails >= 5) {
        this.currentProcess.kill();
        this.runningHealthcheck = false;
        return;
      }
    }

    this.healthy = true;
    this.runningHealthcheck = false;
  }

  serviceHealthy() {
    return this.healthy;
  }

  utils() {
    return this.uutils;
  }
}

export const serviceManager = new ServiceManager();
export default serviceManager;
