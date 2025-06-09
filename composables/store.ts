import type { SerializeObject } from "nitropack";
import type { Company, Game } from "~/prisma/client";
import type { StoreComponentSource } from "~/server/internal/store/types";

export type StoreRenderableItem = SerializeObject<Game | Company>;

const internalSourceCache: Map<typeof StoreComponentSource.infer, string[]> =
  new Map();
const internalGameCache: Map<string, StoreRenderableItem> = new Map();

async function unpackSource(
  source: typeof StoreComponentSource.infer,
  amount?: number,
): Promise<Array<StoreRenderableItem>> {
  const gameIds = internalSourceCache.get(source)!.slice(0, amount);
  const games = gameIds.map((e) => internalGameCache.get(e)!);
  return games;
}
export async function useStoreSource(
  source: typeof StoreComponentSource.infer,
  amount?: number,
): Promise<Array<StoreRenderableItem>> {
  if (internalSourceCache.has(source)) {
    return unpackSource(source, amount);
  }

  const results = (await $dropFetch<unknown>("/api/v1/store/source", {
    query: {
      ...source,
      amount,
    },
  })) as Array<StoreRenderableItem>;

  const gameIds = [];
  for (const result of results) {
    gameIds.push(result.id);
    internalGameCache.set(result.id, result);
  }
  internalSourceCache.set(source, gameIds);

  return unpackSource(source, amount);
}
