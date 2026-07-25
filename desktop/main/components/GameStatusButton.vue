<template>
  <!-- Do not add scale animations to this: https://stackoverflow.com/a/35683068 -->
  <div class="inline-flex divide-x divide-zinc-900">
    <button
      type="button"
      @click="() => fetchStatusStyleData($props.status).action()"
      :class="[
        fetchStatusStyleData($props.status).style,
        showDropdown ? 'rounded-l-md' : 'rounded-md',
        'inline-flex uppercase font-display items-center gap-x-2 px-4 py-3 text-md font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      ]"
    >
      <component
        :is="fetchStatusStyleData($props.status).icon"
        class="-mr-0.5 size-5"
        aria-hidden="true"
      />
      {{ fetchStatusStyleData($props.status).buttonName }}
    </button>
    <Menu v-if="showDropdown" as="div" class="relative inline-block text-left grow">
      <div class="h-full">
        <MenuButton
          :class="[
            fetchStatusStyleData($props.status).style,
            'inline-flex w-full h-full justify-center items-center rounded-r-md px-1 py-2 text-sm font-semibold shadow-sm group',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          ]"
        >
          <ChevronDownIcon class="size-5" aria-hidden="true" />
        </MenuButton>
      </div>

      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <MenuItems
          class="absolute right-0 z-[500] mt-2 w-32 origin-top-right rounded-md bg-zinc-900 shadow-lg ring-1 ring-zinc-100/5 focus:outline-none"
        >
          <div class="py-1">
            <MenuItem v-slot="{ active }">
              <button
                type="button"
                @click="() => emit('install')"
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100 outline-none' : 'text-zinc-400',
                  'w-full px-4 py-2 text-sm inline-flex justify-between',
                ]"
              >
                Install
                <ArrowDownTrayIcon class="size-5" />
              </button>
            </MenuItem>

            <MenuItem v-if="showOptions" v-slot="{ active }">
              <button
                type="button"
                @click="() => emit('options')"
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100 outline-none' : 'text-zinc-400',
                  'w-full px-4 py-2 text-sm inline-flex justify-between',
                ]"
              >
                Options
                <Cog6ToothIcon class="size-5" />
              </button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                type="button"
                @click="() => emit('uninstall')"
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100 outline-none' : 'text-zinc-400',
                  'w-full inline-flex px-4 py-2 text-sm justify-between',
                ]"
              >
                Uninstall
                <TrashIcon class="size-5" />
              </button>
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  PlayIcon,
  QueueListIcon,
  ServerIcon,
  StopIcon,
  WrenchIcon,
} from "@heroicons/vue/20/solid";

import type { Component } from "vue";
import { type EmptyGameStatusEnum, InstalledType, type GameStatus } from "~/types.js";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { Cog6ToothIcon, TrashIcon } from "@heroicons/vue/24/outline";

const props = defineProps<{ status: GameStatus }>();
const emit = defineEmits<{
  (e: "install"): void;
  (e: "launch"): void;
  (e: "queue"): void;
  (e: "uninstall"): void;
  (e: "kill"): void;
  (e: "options"): void;
  (e: "resume"): void;
}>();

interface StatusStyleData {
  style: string;
  buttonName: string;
  icon: Component;
  action: () => void;
}

function fetchStatusStyleData(status: GameStatus): StatusStyleData {
  if (status.type === "Installed") {
    if (status.install_type.type === InstalledType.Installed) {
      return {
        style:
          "bg-green-600 text-white hover:bg-green-500 focus-visible:outline-green-600 hover:bg-green-500",
        buttonName: "Play",
        icon: PlayIcon,
        action: () => emit("launch"),
      };
    }
    if (status.install_type.type === InstalledType.SetupRequired) {
      return {
        style:
          "bg-yellow-600 text-white hover:bg-yellow-500 focus-visible:outline-yellow-600 hover:bg-yellow-500",
        buttonName: "Setup",
        icon: WrenchIcon,
        action: () => emit("launch"),
      };
    }
    if (status.install_type.type === InstalledType.PartiallyInstalled) {
      return {
        style:
          "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600 hover:bg-blue-500",
        buttonName: "Resume",
        icon: ArrowDownTrayIcon,
        action: () => emit("resume"),
      };
    }
    throw new Error("Non-exhaustive install type: " + JSON.stringify(status.install_type));
  }
  return {
    style: styles[status.type],
    buttonName: buttonNames[status.type],
    icon: buttonIcons[status.type],
    action: buttonActions[status.type],
  };
}

const showDropdown = computed(() => props.status.type === "Installed");

const showOptions = computed(
  () =>
    showDropdown.value &&
    props.status.type === "Installed" &&
    props.status.install_type.type !== InstalledType.PartiallyInstalled,
);

const styles: { [key in EmptyGameStatusEnum]: string } = {
  Remote:
    "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600 hover:bg-blue-500",
  Queued:
    "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:outline-zinc-700 hover:bg-zinc-700",
  Downloading:
    "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:outline-zinc-700 hover:bg-zinc-700",
  Validating:
    "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:outline-zinc-700 hover:bg-zinc-700",
  Updating:
    "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:outline-zinc-700 hover:bg-zinc-700",
  Uninstalling:
    "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:outline-zinc-700 hover:bg-zinc-700",
  Running:
    "bg-zinc-800 text-white hover:bg-zinc-700 focus-visible:outline-zinc-700 hover:bg-zinc-700",
};

const buttonNames: { [key in EmptyGameStatusEnum]: string } = {
  Remote: "Install",
  Queued: "Queued",
  Downloading: "Downloading",
  Validating: "Validating",
  Updating: "Updating",
  Uninstalling: "Uninstalling",
  Running: "Stop",
};

const buttonIcons: { [key in EmptyGameStatusEnum]: Component } = {
  Remote: ArrowDownTrayIcon,
  Queued: QueueListIcon,
  Downloading: ArrowDownTrayIcon,
  Validating: ServerIcon,
  Updating: ArrowDownTrayIcon,
  Uninstalling: TrashIcon,
  Running: StopIcon,
};

const buttonActions: { [key in EmptyGameStatusEnum]: () => void } = {
  Remote: () => emit("install"),
  Queued: () => emit("queue"),
  Downloading: () => emit("queue"),
  Validating: () => emit("queue"),
  Updating: () => emit("queue"),
  Uninstalling: () => {},
  Running: () => emit("kill"),
};
</script>
