import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PluginStorage } from "./types";

function defaultDataFolder(): string {
  return process.env.DATA ?? "./.data/data";
}

export class FilePluginStorage implements PluginStorage {
  private readonly filePath: string;
  private readonly schemaPath: string;
  private readonly dirPath: string;
  private cache: Record<string, unknown> | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(pluginId: string, dataDir?: string) {
    const base = dataDir ?? defaultDataFolder();
    this.dirPath = path.join(base, "plugin-data", pluginId);
    this.filePath = path.join(this.dirPath, "state.json");
    this.schemaPath = path.join(this.dirPath, "schema.json");
  }

  async getSchemaVersion(): Promise<number> {
    try {
      const raw = await fs.readFile(this.schemaPath, "utf-8");
      const parsed = JSON.parse(raw) as { version?: unknown };
      return typeof parsed.version === "number" ? parsed.version : 0;
    } catch {
      return 0;
    }
  }

  async setSchemaVersion(version: number): Promise<void> {
    await fs.mkdir(this.dirPath, { recursive: true });
    const tempPath = `${this.schemaPath}.tmp.${randomUUID()}`;
    await fs.writeFile(tempPath, JSON.stringify({ version }, null, 2), "utf-8");
    await fs.rename(tempPath, this.schemaPath);
  }

  private async load(): Promise<Record<string, unknown>> {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.cache = JSON.parse(data) as Record<string, unknown>;
      return this.cache;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  private async persist(): Promise<void> {
    const dataToSave = JSON.stringify(this.cache ?? {}, null, 2);
    // Recover from a failed write so the lock is not permanently poisoned.
    this.writeLock = this.writeLock
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(this.dirPath, { recursive: true });
        const tempPath = `${this.filePath}.tmp.${randomUUID()}`;
        await fs.writeFile(tempPath, dataToSave, "utf-8");
        await fs.rename(tempPath, this.filePath);
      });
    await this.writeLock;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.load();
    if (Object.hasOwn(data, key)) {
      return data[key] as T;
    }
    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const data = await this.load();
    data[key] = value;
    await this.persist();
  }

  async delete(key: string): Promise<void> {
    const data = await this.load();
    if (Object.hasOwn(data, key)) {
      Reflect.deleteProperty(data, key);
      await this.persist();
    }
  }

  async listKeys(): Promise<string[]> {
    const data = await this.load();
    return Object.keys(data);
  }
}
