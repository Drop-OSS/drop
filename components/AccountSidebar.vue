<template>
  <div class="flex grow flex-col gap-y-5 overflow-y-auto px-6 py-4">
    <span class="inline-flex items-center gap-x-2 font-semibold text-zinc-100">
      <UserIcon class="size-5" /> Account Settings
    </span>
    <nav class="flex flex-1 flex-col">
      <ul role="list" class="flex flex-1 flex-col gap-y-7">
        <li>
          <ul role="list" class="-mx-2 space-y-1">
            <li v-for="(item, itemIdx) in navigation" :key="item.route">
              <NuxtLink
                :href="item.route"
                :class="[
                  itemIdx == currentPageIndex
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
                  'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                ]"
              >
                <component
                  :is="item.icon"
                  class="size-6 shrink-0"
                  aria-hidden="true"
                />
                {{ item.label }}
                <span
                  v-if="item.count !== undefined"
                  class="ml-auto w-9 min-w-max whitespace-nowrap rounded-full bg-zinc-900 px-2.5 py-0.5 text-center text-xs/5 font-medium text-white ring-1 ring-inset ring-zinc-700"
                  aria-hidden="true"
                  >{{ item.count }}</span
                >
              </NuxtLink>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
import {
  BellIcon,
  HomeIcon,
  LockClosedIcon,
  DevicePhoneMobileIcon,
  WrenchScrewdriverIcon
} from "@heroicons/vue/24/outline";
import { UserIcon } from "@heroicons/vue/24/solid";
import type { Component } from "vue";

const notifications = useNotifications();

const navigation: (NavigationItem & { icon: Component; count?: number })[] = [
  { label: "Home", route: "/account", icon: HomeIcon, prefix: "/account" },
  {
    label: "Security",
    route: "/account/security",
    prefix: "/account/security",
    icon: LockClosedIcon,
  },
  {
    label: "Devices",
    route: "/account/devices",
    prefix: "/account/devices",
    icon: DevicePhoneMobileIcon,
  },
  {
    label: "Notifications",
    route: "/account/notifications",
    prefix: "/account/notifications",
    icon: BellIcon,
    count: notifications.value.length,
  },
  {
    label: "Settings",
    route: "/account/settings",
    prefix: "/account/settings",
    icon: WrenchScrewdriverIcon,
  },
];

const currentPageIndex = useCurrentNavigationIndex(navigation);
</script>
