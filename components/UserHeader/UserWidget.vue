<template>
  <Menu v-if="user" as="div" class="relative inline-block">
    <MenuButton>
      <UserHeaderWidget>
        <div class="inline-flex items-center text-zinc-300 hover:text-white">
          <img
            :src="useObject(user.profilePicture)"
            class="w-5 h-5 rounded-sm"
          />
          <span class="ml-2 text-sm font-bold">{{ user.displayName }}</span>
          <ChevronDownIcon class="ml-3 h-4" />
        </div>
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
        class="absolute right-0 top-10 z-50 w-56 origin-top-right focus:outline-none shadow-md"
      >
        <PanelWidget class="flex-col gap-y-2">
          <NuxtLink
            :to="`/user/${user.id}`"
            class="transition inline-flex items-center w-full py-3 px-4 hover:bg-zinc-800"
          >
            <div class="inline-flex items-center text-zinc-300">
              <img
                :src="useObject(user.profilePicture)"
                class="w-5 h-5 rounded-sm"
              />
              <span class="ml-2 text-sm font-bold">{{ user.displayName }}</span>
            </div>
          </NuxtLink>
          <div class="h-0.5 rounded-full w-full bg-zinc-800" />
          <div class="flex flex-col">
            <MenuItem
              v-for="(nav, navIdx) in navigation"
              :key="navIdx"
              v-slot="{ active, close }"
              hydrate-on-visible
              as="div"
            >
              <!-- TODO: think this would work better as a NuxtLink instead of a button -->
              <button
                :href="nav.route"
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400',
                  'w-full text-left transition block px-4 py-2 text-sm',
                ]"
                @click="() => navigateTo(nav.route, close)"
              >
                {{ nav.label }}
              </button>
            </MenuItem>
            <MenuItem v-slot="{ active, close }" hydrate-on-visible as="div">
              <!-- TODO: think this would work better as a NuxtLink instead of a button -->
              <a
                :class="[
                  active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400',
                  'w-full text-left transition block px-4 py-2 text-sm',
                ]"
                href="/auth/signout"
              >
                Signout
              </a>
            </MenuItem>
          </div>
        </PanelWidget>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { ChevronDownIcon } from "@heroicons/vue/16/solid";
import { useObject } from "~/composables/objects";
import type { NavigationItem } from "~/composables/types";

const user = useUser();

const navigation: NavigationItem[] = [
  user.value?.admin
    ? {
        label: "Admin Dashboard",
        route: "/admin",
        prefix: "",
      }
    : undefined,
  {
    label: "Account settings",
    route: "/account",
    prefix: "",
  },
].filter((e) => e !== undefined);
</script>
