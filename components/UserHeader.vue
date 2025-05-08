<template>
  <div class="hidden lg:flex bg-zinc-950 flex-row px-12 xl:px-48 py-5">
    <div class="grow inline-flex items-center gap-x-20">
      <NuxtLink :to="homepageURL">
        <DropWordmark class="h-8" />
      </NuxtLink>
      <nav class="inline-flex items-center">
        <ol class="inline-flex items-center gap-x-12">
          <NuxtLink
            v-for="(nav, navIdx) in navigation"
            :key="navIdx"
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
        <li>
          <UserHeaderWidget>
            <UserGroupIcon class="h-5" />
          </UserHeaderWidget>
        </li>

        <li>
          <Menu as="div" class="relative inline-block">
            <MenuButton>
              <UserHeaderWidget :notifications="unreadNotifications.length">
                <BellIcon class="h-5" />
              </UserHeaderWidget>
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
                class="absolute inset-x-0 -translate-x-1/2 top-10 z-50 w-96 focus:outline-none shadow-md"
              >
                <UserHeaderNotificationWidgetPanel
                  :notifications="unreadNotifications"
                />
              </MenuItems>
            </transition>
          </Menu>
        </li>
        <UserHeaderUserWidget />
      </ol>
    </div>
  </div>

  <div
    class="sticky lg:hidden top-0 z-40 flex h-16 justify-between items-center gap-x-4 border-b border-zinc-700 bg-zinc-950 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"
  >
    <NuxtLink :to="homepageURL">
      <DropWordmark class="mb-0.5" />
    </NuxtLink>

    <div class="flex gap-x-4 lg:gap-x-6">
      <div class="flex items-center gap-x-3">
        <!-- Profile dropdown -->
        <UserHeaderUserWidget />

        <button
          type="button"
          class="-m-2.5 p-2.5 text-zinc-400 lg:hidden"
          @click="sidebarOpen = true"
        >
          <span class="sr-only">Open sidebar</span>
          <Bars3Icon class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>

  <TransitionRoot as="template" :show="sidebarOpen">
    <Dialog class="relative z-50 lg:hidden" @close="sidebarOpen = false">
      <TransitionChild
        as="template"
        enter="transition-opacity ease-linear duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="transition-opacity ease-linear duration-300"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-zinc-900/80" />
      </TransitionChild>

      <div class="fixed inset-0 flex">
        <TransitionChild
          as="template"
          enter="transition ease-in-out duration-300 transform"
          enter-from="-translate-x-full"
          enter-to="translate-x-0"
          leave="transition ease-in-out duration-300 transform"
          leave-from="translate-x-0"
          leave-to="-translate-x-full"
        >
          <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
            <TransitionChild
              as="template"
              enter="ease-in-out duration-300"
              enter-from="opacity-0"
              enter-to="opacity-100"
              leave="ease-in-out duration-300"
              leave-from="opacity-100"
              leave-to="opacity-0"
            >
              <div
                class="absolute left-full top-0 flex w-16 justify-center pt-5"
              >
                <button
                  type="button"
                  class="-m-2.5 p-2.5"
                  @click="sidebarOpen = false"
                >
                  <span class="sr-only">Close sidebar</span>
                  <XMarkIcon class="h-6 w-6 text-zinc-400" aria-hidden="true" />
                </button>
              </div>
            </TransitionChild>
            <!-- Sidebar component, swap this element with another sidebar if you like -->
            <div
              class="flex grow flex-col gap-y-5 overflow-y-auto bg-zinc-950 px-6 pb-4"
            >
              <div class="flex shrink-0 h-16 items-center justify-between">
                <NuxtLink :to="homepageURL">
                  <DropLogo class="h-8 w-auto" />
                </NuxtLink>

                <UserHeaderUserWidget />
              </div>
              <nav class="flex flex-1 flex-col gap-y-8">
                <ol class="flex flex-col gap-y-3">
                  <NuxtLink
                    v-for="(nav, navIdx) in navigation"
                    :key="navIdx"
                    :href="nav.route"
                    :class="[
                      'transition hover:text-zinc-200 uppercase font-display font-semibold text-md',
                      navIdx === currentPageIndex
                        ? 'text-zinc-100'
                        : 'text-zinc-400',
                    ]"
                  >
                    {{ nav.label }}
                  </NuxtLink>
                </ol>
                <div class="h-px w-full bg-zinc-700" />
                <div class="flex flex-row gap-x-4 justify-stretch">
                  <li class="w-full">
                    <UserHeaderWidget class="w-full">
                      <UserGroupIcon class="h-5" />
                    </UserHeaderWidget>
                  </li>
                  <li class="w-full">
                    <UserHeaderWidget
                      class="w-full"
                      :notifications="unreadNotifications.length"
                    >
                      <BellIcon class="h-5" />
                    </UserHeaderWidget>
                  </li>
                </div>
              </nav>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { BellIcon, UserGroupIcon } from "@heroicons/vue/16/solid";
import {
  Dialog,
  DialogPanel,
  TransitionChild,
  TransitionRoot,
  Menu,
  MenuButton,
  MenuItems,
} from "@headlessui/vue";
import type { NavigationItem } from "../composables/types";
import { Bars3Icon } from "@heroicons/vue/24/outline";
import { XMarkIcon } from "@heroicons/vue/24/solid";

const router = useRouter();

const homepageURL = "/store";
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

const notifications = useNotifications();
const unreadNotifications = computed(() =>
  notifications.value.filter((e) => !e.read),
);

const sidebarOpen = ref(false);
router.afterEach(() => (sidebarOpen.value = false));
</script>
