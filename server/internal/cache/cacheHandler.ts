import { prefixStorage, type StorageValue, type Storage } from "unstorage";

/**
 * Creates and manages the lifecycles of various caches
 */
export class CacheHandler {
  private caches = new Map<string, Storage<StorageValue>>();

  /**
   * Create a new cache
   * @param name
   * @returns
   */
  createCache<V extends StorageValue>(name: string) {
    // will allow us to dynamicing use redis in the future just by changing the storage used
    const provider = prefixStorage<V>(useStorage<V>("appCache"), name);
    // hack to let ts have us store cache
    this.caches.set(name, provider as unknown as Storage<StorageValue>);
    return provider;
  }
}
