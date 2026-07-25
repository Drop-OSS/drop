<template>
  <Menu v-if="state?.user" as="div" class="relative inline-block">
    <MenuButton>
      <HeaderWidget>
        <div class="inline-flex items-center text-zinc-300 hover:text-white">
          <img :src="profilePictureUrl" class="w-5 h-5 rounded-sm" />
          <span class="ml-2 text-sm font-bold">{{ state.user.displayName }}</span>
          <ChevronDownIcon class="ml-3 h-4" />
        </div>
      </HeaderWidget>
    </MenuButton>

    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <MenuItems
        class="absolute bg-zinc-900 right-0 top-10 z-50 w-56 origin-top-right focus:outline-none shadow-md"
      >
        <div class="flex-col gap-y-2">
          <NuxtLink
            to="/id/me"
            class="transition inline-flex items-center w-full py-3 px-4 hover:bg-zinc-800"
          >
            <div class="inline-flex items-center text-zinc-300">
              <img :src="profilePictureUrl" class="w-5 h-5 rounded-sm" />
              <span class="ml-2 text-sm font-bold">{{ state.user.displayName }}</span>
            </div>
          </NuxtLink>
          <div class="h-0.5 rounded-full w-full bg-zinc-800" />
          <div class="flex flex-col mb-1">
            <MenuItem v-if="state.user.admin" v-slot="{ active }">
              <a
                :href="adminUrl"
                target="_blank"
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400',
                  'transition block px-4 py-2 text-sm',
                ]"
              >
                Admin Dashboard
              </a>
            </MenuItem>
            <MenuItem v-for="(nav, navIdx) in navigation" v-slot="{ active, close }">
              <button
                type="button"
                @click="() => navigate(close, nav)"
                :href="nav.route"
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400',
                  'transition text-left block px-4 py-2 text-sm',
                ]"
              >
                {{ nav.label }}
              </button>
            </MenuItem>
          </div>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { ChevronDownIcon } from "@heroicons/vue/16/solid";
import type { NavigationItem } from "../types";
import HeaderWidget from "./HeaderWidget.vue";
import { useAppState } from "~/composables/app-state";
import { invoke } from "@tauri-apps/api/core";

const open = ref(false);
const router = useRouter();
router.afterEach(() => {
  open.value = false;
});

const state = useAppState();
const profilePictureUrl: string = await useObject(state.value?.user?.profilePictureObjectId ?? "");
const adminUrl: string = await invoke("gen_drop_url", {
  path: "/admin",
});

function navigate(close: () => any, to: NavigationItem) {
  close();
  router.push(to.route);
}

const navigation: NavigationItem[] = [
  {
    label: "App settings",
    route: "/settings",
    prefix: "",
  },
  {
    label: "Quit Drop",
    route: "/quit",
    prefix: "",
  },
];
</script>
