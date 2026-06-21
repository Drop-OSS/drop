<template>
  <ModalTemplate size-class="max-w-4xl" v-model="open">
    <template #default>
      <div class="flex flex-row gap-x-4 min-h-96">
        <nav class="flex flex-1 flex-col" aria-label="Sidebar">
          <ul role="list" class="-mx-2 space-y-1">
            <li v-for="(tab, tabIdx) in tabs" :key="tab.name">
              <button
                @click="() => (currentTabIndex = tabIdx)"
                :class="[
                  tabIdx == currentTabIndex
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                  'transition w-full group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                ]"
              >
                <component
                  :is="tab.icon"
                  :class="[
                    tabIdx == currentTabIndex
                      ? 'text-zinc-100'
                      : 'text-gray-400 group-hover:text-zinc-100',
                    'size-6 shrink-0',
                  ]"
                  aria-hidden="true"
                />
                {{ tab.name }}
              </button>
            </li>
          </ul>
        </nav>
        <div class="border-l-2 border-zinc-800 w-full grow pl-4">
          <component
            v-model="configuration"
            :is="tabs[currentTabIndex]?.page"
            :proton-enabled="protonEnabled"
            :game-id="props.gameId"
          />
        </div>
      </div>
      <div v-if="saveError" class="mt-5 rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ saveError }}
            </h3>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        @click="() => save()"
        :loading="saveLoading"
        type="submit"
        class="ml-2 w-full sm:w-fit"
      >
        Save
      </LoadingButton>
      <button
        @click="() => (open = false)"
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import {
  RocketLaunchIcon,
  ServerIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/vue/20/solid";
import Launch from "./GameOptions/Launch.vue";
import Updates from "./GameOptions/Updates.vue";
import { invoke } from "@tauri-apps/api/core";
import { ArrowPathIcon } from "@heroicons/vue/24/solid";
import type { GameVersion } from "~/types";

const appState = useAppState();

const open = defineModel<boolean>();
const props = defineProps<{ gameId: string }>();
const game = await useGame(props.gameId);

const configuration: Ref<GameVersion["userConfiguration"]> = ref(game.version.value!.userConfiguration);

const hasWindows = !!(
  game.version.value!.setups.find((v) => v.platform === "Windows") ??
  game.version.value!.launches.find((v) => v.platform === "Windows")
);

const protonEnabled = !!(
  appState.value!.umuState !== "NotNeeded" && hasWindows
);

const tabs: Array<{ name: string; icon: Component; page: Component }> = [
  {
    name: "Launch",
    icon: RocketLaunchIcon,
    page: Launch,
  },
  {
    name: "Updates",
    icon: ArrowPathIcon,
    page: Updates,
  },
  {
    name: "Storage",
    icon: ServerIcon,
    page: h("div"),
  },
];
const currentTabIndex = ref(0);

const saveLoading = ref(false);
const saveError = ref<undefined | string>();
async function save() {
  saveLoading.value = true;
  saveError.value = undefined;
  try {
    await invoke("update_game_configuration", {
      gameId: game.game.id,
      options: configuration.value,
    });
    open.value = false;
    saveError.value = undefined;
  } catch (e) {
    saveError.value = (e as unknown as string).toString();
  }
  saveLoading.value = false;
}
</script>
