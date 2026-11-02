/**
 * The save service reaches for two Nitro runtime helpers on the way down to the
 * object store: `sys-conf` reads `dropVersion`/`gitRef` from `useRuntimeConfig`,
 * and the cache layer behind the object metadata store comes from
 * `useStorage("appCache")`. Outside a Nitro process those two are the whole
 * gap, so this installs just enough of them - an in-memory cache and a version
 * string - for the service to run under plain Node.
 *
 * Import it before anything under `~/server/internal/...`: ESM evaluates
 * imports in declaration order, so the globals exist by the time the service
 * modules construct their singletons.
 */
import { createStorage, type Storage, type StorageValue } from "unstorage";
import memory from "unstorage/drivers/memory";

declare const globalThis: {
  useRuntimeConfig?: () => { dropVersion: string; gitRef: string };
  useStorage?: <T extends StorageValue>(base?: string) => Storage<T>;
} & typeof global;

if (typeof globalThis.useRuntimeConfig !== "function")
  globalThis.useRuntimeConfig = () => ({
    dropVersion: "e2e",
    gitRef: "e2e",
  });

if (typeof globalThis.useStorage !== "function")
  globalThis.useStorage = <T extends StorageValue>(_base?: string) =>
    createStorage<T>({ driver: memory() });
