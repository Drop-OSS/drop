import type { Collection, CollectionEntry, Game } from "@prisma/client";
import type { SerializeObject } from "nitropack";

type FullCollection = Collection & {
  entries: Array<CollectionEntry & { game: SerializeObject<Game> }>;
};

export const useCollections = async () => {
  // @ts-expect-error
  const state = useState<FullCollection[]>("collections", () => undefined);
  if (state.value === undefined) {
    const headers = useRequestHeaders(["cookie"]);
    state.value = await $dropFetch<FullCollection[]>("/api/v1/collection", {
      headers,
    });
  }

  return state;
};

export async function refreshCollection(id: string) {
  const state = useState<FullCollection[]>("collections");
  const collection = await $dropFetch<FullCollection>(`/api/v1/collection/${id}`);
  const index = state.value.findIndex((e) => e.id == id);
  if (index == -1) {
    state.value.push(collection);
    return;
  }
  state.value[index] = collection;
}

export const useLibrary = async () => {
  // @ts-expect-error
  const state = useState<FullCollection>("library", () => undefined);
  if (state.value === undefined) {
    await refreshLibrary();
  }

  return state;
};

export async function refreshLibrary() {
  const state = useState<FullCollection>("library");
  const headers = useRequestHeaders(["cookie"]);
  state.value = await $dropFetch<FullCollection>("/api/v1/collection/default", {
    headers,
  });
}
