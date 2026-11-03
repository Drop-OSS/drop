<template>
  <div class="h-16 bg-surface-950 flex flex-row justify-between">
    <div class="flex flex-row grow items-center pl-5 pr-2 py-3">
      <div class="inline-flex items-center gap-x-10">
        <NuxtLink to="/store">
          <Wordmark class="h-8 mb-0.5" />
        </NuxtLink>
        <nav class="inline-flex items-center mt-0.5">
          <ol class="inline-flex items-center gap-x-6">
            <NuxtLink
              v-for="(nav, navIdx) in navigation"
              :class="[
                'transition  uppercase font-display font-semibold text-md',
                navIdx === currentNavigation
                  ? 'text-ink-100'
                  : 'text-ink-400 hover:text-ink-200',
              ]"
              :href="nav.route"
            >
              {{ nav.label }}
            </NuxtLink>
          </ol>
        </nav>
      </div>
      <div
        @mousedown="() => window.startDragging()"
        class="flex cursor-pointer grow h-full"
      />
      <div class="inline-flex items-center">
        <ol class="inline-flex gap-3">
          <HeaderProtonSupportWidget />
          <HeaderQueueWidget :object="currentQueueObject" />
          <li v-for="(item, itemIdx) in quickActions">
            <HeaderWidget
              @click="item.action"
              :notifications="item.notifications"
            >
              <component class="h-5" :is="item.icon" />
            </HeaderWidget>
          </li>
          <OfflineHeaderWidget v-if="state?.status === AppStatus.Offline" />
          <HeaderUserWidget />
        </ol>
      </div>
    </div>
    <WindowControl  />
  </div>
</template>

<script setup lang="ts">
import { BellIcon, UserGroupIcon } from "@heroicons/vue/16/solid";
import { AppStatus, type NavigationItem, type QuickActionNav } from "../types";
import HeaderWidget from "./HeaderWidget.vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

const window = getCurrentWindow();
const state = useAppState();

const navigation: Array<NavigationItem> = [
  {
    prefix: "/store",
    route: "/store",
    label: "Store",
  },
  {
    prefix: "/library",
    route: "/library",
    label: "Library",
  },
  {
    prefix: "/community",
    route: "/community",
    label: "Community",
  },
  {
    prefix: "/news",
    route: "/news",
    label: "News",
  },
];

const { currentNavigation } = useCurrentNavigationIndex(navigation);

const quickActions: Array<QuickActionNav> = [
  {
    icon: UserGroupIcon,
    action: async () => {},
  },
  {
    icon: BellIcon,
    action: async () => {},
  },
];

const queue = useQueueState();
const currentQueueObject = computed(() => queue.value.queue.at(0));
</script>
