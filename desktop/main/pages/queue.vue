<template>
  <div class="bg-zinc-950 p-4 min-h-full space-y-4">
    <div class="h-16 overflow-hidden relative rounded-xl flex flex-row border border-zinc-900">
      <div
        class="bg-zinc-900 z-10 w-32 flex flex-col gap-x-2 font-display items-left justify-center pl-2"
      >
        <span class="font-bold text-zinc-100">{{ formatKilobytes(stats.speed) }}B/s</span>
        <span class="text-xs text-zinc-400">{{ formatTime(stats.time) }} left</span>
      </div>
      <div class="absolute inset-0 h-full flex flex-row items-end justify-end space-x-[1px]">
        <div
          v-for="bar in speedHistory"
          :style="{ height: `${(bar / speedMax) * 100}%` }"
          class="w-[3px] bg-blue-600 rounded-t-full"
        />
      </div>
    </div>
    <draggable v-model="queue.queue" @end="onEnd">
      <template #item="{ element }: ListIterable">
        <li
          v-if="games[element.meta.id]"
          :key="element.meta.id"
          class="mb-4 bg-zinc-900 rounded-lg flex flex-row justify-between gap-x-6 py-5 px-4"
        >
          <div class="w-full flex items-center max-w-md gap-x-4 relative">
            <img
              class="size-24 flex-none bg-zinc-800 object-cover rounded"
              :src="games[element.meta.id].cover"
              alt=""
            />
            <div class="min-w-0 flex-auto">
              <p class="text-xl font-semibold text-zinc-100">
                <NuxtLink :href="`/library/${element.meta.id}`" class="">
                  <span class="absolute inset-x-0 -top-px bottom-0" />
                  {{ games[element.meta.id].game.mName }}
                </NuxtLink>
              </p>
              <p class="mt-1 flex text-xs/5 text-gray-500">
                {{ games[element.meta.id].game.mShortDescription }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-x-4">
            <div class="hidden sm:flex sm:flex-col sm:items-end">
              <p class="text-md text-zinc-500 uppercase font-display font-bold">
                {{ element.status }}
              </p>
              <div
                v-if="element.dl_progress"
                class="mt-1 w-96 bg-zinc-800 rounded-lg overflow-hidden"
              >
                <div class="h-2 bg-blue-600" :style="{ width: `${element.dl_progress * 100}%` }" />
              </div>
              <span class="mt-2 inline-flex items-center gap-x-1 text-zinc-400 text-sm font-display"
                ><span class="text-zinc-300"
                  >{{ formatKilobytes(element.dl_current / 1000) }}B</span
                >
                /
                <span class="">{{ formatKilobytes(element.dl_max / 1000) }}B</span
                ><CloudIcon class="size-5"
              /></span>
              <div
                v-if="element.dl_max !== element.disk_max"
                class="h-[1px] my-2 w-full bg-zinc-700"
              />
              <div
                v-if="element.disk_progress && element.dl_max !== element.disk_max"
                class="mt-1 w-96 bg-zinc-800 rounded-lg overflow-hidden"
              >
                <div
                  class="h-2 bg-blue-600"
                  :style="{ width: `${element.disk_progress * 100}%` }"
                />
              </div>
              <span
                v-if="element.dl_max !== element.disk_max"
                class="mt-2 inline-flex items-center gap-x-1 text-zinc-400 text-sm font-display"
                ><span class="text-zinc-300"
                  >{{ formatKilobytes(element.disk_current / 1000) }}B</span
                >
                /
                <span class="">{{ formatKilobytes(element.disk_max / 1000) }}B</span
                ><ServerIcon class="size-5"
              /></span>
            </div>
            <button type="button" @click="() => cancelGame(element.meta)" class="group">
              <XMarkIcon
                class="transition size-8 flex-none text-zinc-600 group-hover:text-zinc-300"
                aria-hidden="true"
              />
            </button>
          </div>
        </li>
        <p v-else>Loading...</p>
      </template>
    </draggable>
    <div
      class="text-zinc-600 uppercase font-semibold font-display w-full text-center"
      v-if="queue.queue.length == 0"
    >
      No items in the queue
    </div>
  </div>
</template>

<script setup lang="ts">
import { ServerIcon, XMarkIcon, CloudIcon } from "@heroicons/vue/20/solid";
import { invoke } from "@tauri-apps/api/core";
import { type DownloadableMetadata, type Game, type GameStatus } from "~/types";

// const actionNames = {
//   [GameStatusEnum.Downloading]: "downloading",
//   [GameStatusEnum.Verifying]: "verifying",
// }

const windowWidth = ref(window.innerWidth);
window.addEventListener("resize", (event) => {
  windowWidth.value = window.innerWidth;
});

const queue = useQueueState();
const stats = useStatsState();
const speedHistory = useDownloadHistory();
const speedHistoryMax = computed(() => windowWidth.value / 4);
const speedMax = computed(() => speedHistory.value.reduce((a, b) => (a > b ? a : b)) * 1.1);
const previousGameId = useState<string | undefined>("previous_game");

type ListIterable = { element: (typeof queue.value.queue)[0] };

const games: Ref<{
  [key: string]: { game: Game; status: Ref<GameStatus>; cover: string };
}> = ref({});

function resetHistoryGraph() {
  speedHistory.value = [];
  stats.value = { time: 0, speed: 0 };
}
function checkReset(v: QueueState) {
  const currentGame = v.queue.at(0)?.meta.id;
  // If we don't have a game
  if (!currentGame) return;

  // If we're finished
  if (!currentGame && previousGameId.value) {
    previousGameId.value = undefined;
    resetHistoryGraph();
    return;
  }
  // If we started a new download
  if (currentGame && !previousGameId.value) {
    previousGameId.value = currentGame;
    resetHistoryGraph();
    return;
  }
  // If it's a different game now
  if (currentGame != previousGameId.value) {
    previousGameId.value = currentGame;
    resetHistoryGraph();
    return;
  }
}
watch(queue, (v) => {
  loadGamesForQueue(v);
  checkReset(v);
});

watch(stats, (v) => {
  if (v.speed == 0) return;
  const newLength = speedHistory.value.push(v.speed);
  if (newLength > speedHistoryMax.value) {
    speedHistory.value.splice(0, newLength - speedHistoryMax.value);
  }
  checkReset(queue.value);
});

function loadGamesForQueue(v: typeof queue.value) {
  for (const {
    meta: { id },
  } of v.queue) {
    if (games.value[id]) return;
    (async () => {
      const gameData = await useGame(id);
      const cover = await useObject(gameData.game.mCoverObjectId);
      games.value[id] = { ...gameData, cover };
    })();
  }
}

loadGamesForQueue(queue.value);

async function onEnd(event: { oldIndex: number; newIndex: number }) {
  await invoke("move_download_in_queue", {
    oldIndex: event.oldIndex,
    newIndex: event.newIndex,
  });
}

async function cancelGame(meta: DownloadableMetadata) {
  await invoke("cancel_game", { meta });
}

function formatTime(seconds: number): string {
  if (seconds == 0) {
    return `0s`;
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${Math.round(seconds % 60)}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
</script>
