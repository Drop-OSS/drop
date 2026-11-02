import { createError } from "h3";

/**
 * Bounded worker pool for the depot transfer connectors, shaped like the
 * Ubisoft slice workers a live 2.5GB+ acquisition already runs: a shared
 * queue, first failure stops all pulling, cancellation is checked before
 * every item — never an unbounded `Promise.all` over thousands of files.
 *
 * Output ordering is the caller's job (write `results[index]` from `run`):
 * workers finish in network order, but manifests must stay deterministic.
 */
export async function forEachPooled<T>(
  items: readonly T[],
  concurrency: number,
  signal: AbortSignal | undefined,
  abortMessage: string,
  run: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const width = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  let failure: unknown = null;
  const workers = Array.from({ length: width }, async () => {
    for (;;) {
      if (failure) return;
      if (signal?.aborted) {
        failure ??= createError({
          statusCode: 499,
          statusMessage: abortMessage,
        });
        return;
      }
      const index = next++;
      if (index >= items.length) return;
      try {
        await run(items[index]!, index);
      } catch (error) {
        failure ??= error;
        return;
      }
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;
}
