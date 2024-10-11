<template>
  <div class="hidden lg:flex bg-zinc-950 flex-row px-12 xl:px-48 py-5">
    <div class="grow inline-flex items-center gap-x-20">
      <NuxtLink to="/">
        <Wordmark class="h-8" />
      </NuxtLink>
      <nav class="inline-flex items-center">
        <ol class="inline-flex items-center gap-x-12">
          <NuxtLink
            v-for="(nav, navIdx) in navigation"
            :href="nav.route"
            :class="[
              'transition hover:text-zinc-200 uppercase font-display font-semibold text-md',
              navIdx === currentPageIndex ? 'text-zinc-100' : 'text-zinc-400',
            ]"
          >
            {{ nav.label }}
          </NuxtLink>
        </ol>
      </nav>
    </div>
    <div class="inline-flex items-center">
      <ol class="inline-flex gap-3">
        <li v-for="(item, itemIdx) in quickActions">
          <HeaderWidget
            @click="item.action"
            :notifications="item.notifications"
          >
            <component class="h-5" :is="item.icon" />
          </HeaderWidget>
        </li>
        <HeaderUserWidget />
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BellIcon, UserGroupIcon } from "@heroicons/vue/16/solid";
import type { NavigationItem, QuickActionNav } from "../composables/types";
import HeaderWidget from "./HeaderWidget.vue";

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

const currentPageIndex = useCurrentNavigationIndex(navigation);

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
</script>
