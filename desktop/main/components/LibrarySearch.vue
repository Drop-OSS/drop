<template>
  <div class="flex flex-col h-full">
    <div class="mb-3 inline-flex gap-x-2">
      <div class="relative transition-transform duration-300 hover:scale-105 active:scale-95">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon class="h-5 w-5 text-zinc-400" aria-hidden="true" />
        </div>
        <input
          type="text"
          v-model="searchQuery"
          class="block w-full rounded-lg border-0 bg-zinc-800/50 py-2 pl-10 pr-3 text-zinc-100 placeholder:text-zinc-500 focus:bg-zinc-800 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
          placeholder="Search library..."
        />
      </div>
      <button
        type="button"
        @click="() => calculateGames(true, true)"
        class="p-1 flex items-center justify-center transition-transform duration-300 size-10 hover:scale-110 active:scale-90 rounded-lg bg-zinc-800/50 text-zinc-100"
      >
        <ArrowPathIcon class="size-4" />
      </button>
    </div>

    <TransitionGroup name="list" tag="ul" class="flex flex-col gap-y-1.5 h-full">
      <Disclosure
        as="div"
        v-for="(nav, navIndex) in filteredNavigation"
        :key="nav.id"
        :class="[
          'first:pt-0 last:pb-0',
          nav.tools && !filteredNavigation[navIndex - 1]?.tools ? 'mt-auto' : '',
        ]"
        v-slot="{ open }"
        :default-open="nav.deft"
      >
        <dt>
          <DisclosureButton
            class="flex w-full items-center justify-between text-left text-gray-900 dark:text-white"
          >
            <span class="text-sm font-semibold font-display">{{ nav.name }}</span>
            <span class="ml-6 relative flex size-4">
              <MinusIcon class="absolute inset-0 size-4" aria-hidden="true" />
              <MinusIcon
                :class="[
                  !open ? 'rotate-90' : 'rotate-0',
                  'transition-all absolute inset-0 size-4',
                ]"
                aria-hidden="true"
              />
            </span>
          </DisclosureButton>
        </dt>
        <DisclosurePanel as="dd" class="mt-2 flex flex-col gap-y-1.5">
          <NuxtLink
            v-for="item in nav.items"
            :key="nav.id"
            :class="[
              'transition-all duration-300 rounded-lg flex items-center px-1 py-0.5 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-zinc-950/50',
              currentNavigation == item.id
                ? 'bg-zinc-800 text-zinc-100 shadow-md shadow-zinc-950/20'
                : item.isInstalled.value
                  ? 'text-zinc-300 hover:bg-zinc-800/90 hover:text-zinc-200'
                  : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300',
            ]"
            :href="item.route"
          >
            <div class="flex items-center w-full gap-x-2">
              <div class="flex-none transition-transform duration-300 hover:-rotate-2">
                <img
                  class="size-6 object-cover bg-zinc-900 rounded transition-all duration-300 shadow-sm"
                  :src="useObject(item.icon)"
                  alt=""
                />
              </div>
              <div class="truncate flex flex-col">
                <p class="text-sm whitespace-nowrap font-display font-semibold">
                  {{ item.label }}
                </p>
                <p
                  class="truncate text-[10px] font-bold uppercase font-display"
                  :class="[getGameStatusStyleText(games[item.id].status.value)[0]]"
                >
                  {{ getGameStatusStyleText(games[item.id].status.value)[1] }}
                </p>
              </div>
            </div>
          </NuxtLink>
          <span v-if="nav.items.length == 0" class="text-xs text-zinc-500 mx-auto"
            >No games in this category</span
          >
        </DisclosurePanel>
      </Disclosure>
    </TransitionGroup>
    <div v-if="loading" class="h-full grow flex p-8 justify-center text-zinc-100">
      <div role="status">
        <svg
          aria-hidden="true"
          class="w-6 h-6 text-transparent animate-spin fill-zinc-600"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
        <span class="sr-only">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
import { ArrowPathIcon, MagnifyingGlassIcon, MinusIcon } from "@heroicons/vue/20/solid";
import { invoke } from "@tauri-apps/api/core";
import {
  type EmptyGameStatusEnum,
  InstalledType,
  type Collection as Collection,
  type Game,
  type GameStatus,
} from "~/types";
import { TransitionGroup } from "vue";
import { listen } from "@tauri-apps/api/event";

// Style information
const gameStatusTextStyle: { [key in EmptyGameStatusEnum]: string } = {
  Downloading: "text-zinc-400",
  Validating: "text-blue-300",
  Running: "text-blue-500",
  Remote: "text-zinc-700",
  Queued: "text-zinc-400",
  Updating: "text-zinc-400",
  Uninstalling: "text-zinc-100",
};
const gameStatusText: { [key in EmptyGameStatusEnum]: string } = {
  Remote: "Not installed",
  Queued: "Queued",
  Downloading: "Downloading...",
  Validating: "Validating...",
  Updating: "Updating...",
  Uninstalling: "Uninstalling...",
  Running: "Running",
};

function getGameStatusStyleText(status: GameStatus): [string, string] {
  if (status.type === "Installed") {
    if (status.install_type.type === InstalledType.Installed) {
      return ["text-green-500", "Installed"];
    }
    if (status.install_type.type === InstalledType.PartiallyInstalled) {
      return ["text-gray-400", "Partially installed"];
    }
    if (status.install_type.type === InstalledType.SetupRequired) {
      return ["text-yellow-500", "Setup required"];
    }
    throw new Error(
      "Non-exhaustive installed type, missing: " + JSON.stringify(status.install_type),
    );
  }
  return [gameStatusTextStyle[status.type], gameStatusText[status.type]];
}

const router = useRouter();

const searchQuery = ref("");

const loading = ref(false);
const games: {
  [key: string]: { game: Game; status: Ref<GameStatus, GameStatus> };
} = {};

const collections: Ref<Collection[]> = ref([]);

async function calculateGames(clearAll = false, forceRefresh = false) {
  try {
    await calculateGamesLogic(clearAll, forceRefresh);
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to fetch library",
        description: `Drop encountered an error while fetching your library: ${e}`,
      },
      (_, c) => c(),
    );
  }
  loading.value = false;
}

type FetchLibraryResponse = {
  library: Game[];
  collections: Collection[];
  other: Game[];
  missing: Game[];
};

async function calculateGamesLogic(clearAll = false, forceRefresh = false) {
  if (clearAll) {
    collections.value = [];
    loading.value = true;
  }
  // If we update immediately, the navigation gets re-rendered before we
  // add all the necessary state, and it freaks tf out
  const library = await invoke<FetchLibraryResponse>("fetch_library", {
    hardRefresh: forceRefresh,
  });
  const allGames = [
    ...library.library,
    ...library.collections
      .map((e) => e.entries)
      .flat()
      .map((e) => e.game),
    ...library.other,
    ...library.missing,
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const game of allGames) {
    if (games[game.id]) continue;
    games[game.id] = await useGame(game.id);
  }

  const libraryCollection = {
    id: "library",
    name: "Library",
    isDefault: true,
    entries: library.library.map((e) => ({ gameId: e.id, game: e })),
  } satisfies Collection;

  const otherCollection = {
    id: "other",
    name: "Tools & Launchers",
    isDefault: false,
    isTools: true,
    entries: library.other.map((v) => ({ gameId: v.id, game: v })),
  } satisfies Collection;

  const missingCollection = {
    id: "missing",
    name: "Delisted",
    isDefault: false,
    isTools: true,
    entries: library.missing.map((v) => ({ gameId: v.id, game: v })),
  };

  loading.value = false;
  collections.value = [
    libraryCollection,
    ...library.collections,
    ...(library.other.length > 0 ? [otherCollection] : []),
    ...(library.missing.length > 0 ? [missingCollection] : []),
  ];
}

// Wait up to 300 ms for the library to load, otherwise
// show the loading state while we while
await new Promise<void>((r) => {
  let hasResolved = false;
  const resolveFunc = () => {
    if (!hasResolved) r();
    hasResolved = true;
  };
  calculateGames(true).then(resolveFunc);
  setTimeout(resolveFunc, 300);
});

const navigation = computed(() =>
  collections.value.map((collection) => {
    const items = collection.entries.map(({ game }) => {
      const status = games[game.id].status;

      const isInstalled = computed(() => status.value.type != "Remote");

      const item = {
        label: game.mName,
        route: `/library/${game.id}`,
        prefix: `/library/${game.id}`,
        icon: game.mIconObjectId,
        isInstalled,
        id: game.id,
        type: game.type,
      };
      return item;
    });

    return {
      id: collection.id,
      name: collection.name,
      deft: collection.isDefault,
      tools: collection.isTools ?? false,
      items,
    };
  }),
);

const route = useRoute();
const currentNavigation = computed(() => {
  return route.path.slice("/library/".length);
});

const filteredNavigation = computed(() => {
  if (!searchQuery.value) return navigation.value.map((e, i) => ({ ...e, index: i }));
  const query = searchQuery.value.toLowerCase();
  return navigation.value
    .map((c) => ({
      ...c,
      items: c.items.filter((nav) => nav.label.toLowerCase().includes(query)),
    }))
    .filter((e) => e.items.length > 0);
});

listen("update_library", async (event) => {
  console.log("Updating library");
  let oldNavigation = currentNavigation.value;
  await calculateGames(false, true);
  if (oldNavigation !== currentNavigation.value) {
    router.push("/library");
  }
});
</script>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-leave-active {
  position: absolute;
}
</style>
