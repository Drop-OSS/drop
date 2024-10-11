<template>
  <div>
    <!-- Static sidebar for desktop -->
    <div
      class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-20 lg:overflow-y-auto lg:bg-zinc-950 lg:pb-4"
    >
      <div class="flex flex-col h-24 shrink-0 items-center justify-center">
        <Logo class="h-8 w-auto" />
        <span
          class="mt-1 bg-blue-400 px-1 py-0.5 rounded-md text-xs font-bold font-display"
          >Admin</span
        >
      </div>
      <nav class="mt-8">
        <ul role="list" class="flex flex-col items-stretch space-y-4 mx-2">
          <li v-for="(item, itemIdx) in navigation" :key="item.route">
            <NuxtLink
              :href="item.route"
              :class="[
                itemIdx === currentNavigationIndex
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white',
                'transition group flex flex-col items-center grow gap-x-3 rounded-md px-2 py-3 text-sm font-semibold leading-6',
              ]"
            >
              <component
                :is="item.icon"
                class="h-6 w-6 shrink-0"
                aria-hidden="true"
              />
              <span class="text-xs text-center">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>

    <div
      class="sticky top-0 z-40 flex items-center gap-x-6 bg-zinc-900 px-4 py-4 shadow-sm sm:px-6 lg:hidden"
    >
      <button
        type="button"
        class="-m-2.5 p-2.5 text-zinc-400 lg:hidden"
        @click="sidebarOpen = true"
      >
        <span class="sr-only">Open sidebar</span>
        <Bars3Icon class="h-6 w-6" aria-hidden="true" />
      </button>
    </div>

    <main class="lg:pl-20 min-h-screen bg-zinc-900 flex flex-col">
      <div class="flex flex-col grow px-4 py-2 sm:py-10 sm:px-6 lg:px-8 lg:py-6">
        <!-- Main area -->
        <NuxtPage />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, type Component } from "vue";
import {
  Bars3Icon,
  ServerStackIcon,
  HomeIcon,
  LockClosedIcon,
  Cog6ToothIcon,
  FlagIcon,
} from "@heroicons/vue/24/outline";
import type { NavigationItem } from "~/composables/types";
import { useCurrentNavigationIndex } from "~/composables/current-page-engine";
import { ArrowLeftIcon } from "@heroicons/vue/16/solid";

const navigation: Array<NavigationItem & { icon: Component }> = [
  { label: "Home", route: "/admin", prefix: "/admin", icon: HomeIcon },
  {
    label: "Library",
    route: "/admin/library",
    prefix: "/admin/library",
    icon: ServerStackIcon,
  },
  {
    label: "Auth",
    route: "/admin/auth",
    prefix: "/admin/auth",
    icon: LockClosedIcon,
  },
  {
    label: "Feature Flags",
    route: "/admin/features",
    prefix: "/admin/features",
    icon: FlagIcon,
  },
  {
    label: "Settings",
    route: "/admin/settings",
    prefix: "/admin/settings",
    icon: Cog6ToothIcon,
  },
  {
    label: "Back",
    route: "/",
    prefix: ".",
    icon: ArrowLeftIcon
  }
];

const currentNavigationIndex = useCurrentNavigationIndex(navigation);

const sidebarOpen = ref(false);

useHead({
  titleTemplate(title) {
    return title ? `${title} | Admin | Drop` : `Admin Dashboard | Drop`;
  },
});
</script>
