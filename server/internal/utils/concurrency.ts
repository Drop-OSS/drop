/**
 * Concurrency limiter utility to prevent memory exhaustion
 * when processing large numbers of files or archive operations
 */

/**
 * Creates a queue that limits the number of concurrent operations
 * @param limit Maximum number of concurrent operations (default: 1)
 * @returns A function that queues async operations
 */
export function createConcurrencyLimiter(limit: number = 1) {
  let running = 0;
  const queue: Array<() => Promise<unknown>> = [];

  const run = async (fn: () => Promise<unknown>): Promise<unknown> => {
    while (running >= limit) {
      await new Promise((resolve) => {
        // Add a small delay to prevent busy-waiting
        setTimeout(resolve, 10);
      });
    }

    running++;
    try {
      return await fn();
    } finally {
      running--;
      // Process next queued item if any
      if (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          run(next);
        }
      }
    }
  };

  return {
    /**
     * Queue an async operation
     * @param fn Async function to execute
     * @returns Promise that resolves when operation completes
     */
    queue: (fn: () => Promise<unknown>): Promise<unknown> => {
      if (running < limit) {
        return run(fn);
      }
      return new Promise((resolve, reject) => {
        queue.push(async () => {
          try {
            resolve(await run(fn));
          } catch (err) {
            reject(err);
          }
        });
      });
    },

    /**
     * Get current number of running operations
     */
    running: () => running,

    /**
     * Get number of queued operations
     */
    queued: () => queue.length,

    /**
     * Process array of items sequentially
     * @param items Array of items to process
     * @param processor Function that processes each item
     * @returns Promise resolving to array of results
     */
    processSequential: async <T, R>(
      items: T[],
      processor: (item: T) => Promise<R>,
    ): Promise<R[]> => {
      const results: R[] = [];
      for (const item of items) {
        const result = await run(() => processor(item));
        results.push(result as R);
      }
      return results;
    },
  };
}

/**
 * Process items with a maximum concurrency
 * Simpler alternative to createConcurrencyLimiter for one-off usage
 * @param items Array of items to process
 * @param processor Async function to process each item
 * @param maxConcurrency Maximum concurrent operations (default: 1)
 * @returns Promise resolving to array of results
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  maxConcurrency: number = 1,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = Promise.resolve().then(async () => {
      results[i] = await processor(items[i], i);
    });
    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p.toString().includes("[object Promise]")),
        1,
      );
    }
  }

  await Promise.all(executing);
  return results;
}
