<template>
  <div class="inline-flex divide-x divide-zinc-900">
    <button
      type="button"
      class="inline-flex justify-center items-center gap-x-2 rounded-l-md aspect-[7/2] px-3 py-2 bg-blue-600 grow text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      Add to Library
      <PlusIcon class="-mr-0.5 size-6" aria-hidden="true" />
    </button>
    <Menu as="div" class="relative inline-block text-left grow">
      <div class="h-full">
        <MenuButton
          class="inline-flex h-full w-full justify-center items-center rounded-r-md bg-blue-600 p-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ChevronDownIcon
            class="size-5"
            aria-hidden="true"
          />
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
          class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          <div class="py-1">
            <MenuItem v-slot="{ active }">
              <a
                href="#"
                :class="[
                  active
                    ? 'bg-gray-100 text-gray-900 outline-none'
                    : 'text-gray-700',
                  'block px-4 py-2 text-sm',
                ]"
                >Account settings</a
              >
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <a
                href="#"
                :class="[
                  active
                    ? 'bg-gray-100 text-gray-900 outline-none'
                    : 'text-gray-700',
                  'block px-4 py-2 text-sm',
                ]"
                >Support</a
              >
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <a
                href="#"
                :class="[
                  active
                    ? 'bg-gray-100 text-gray-900 outline-none'
                    : 'text-gray-700',
                  'block px-4 py-2 text-sm',
                ]"
                >License</a
              >
            </MenuItem>
            <form method="POST" action="#">
              <MenuItem v-slot="{ active }">
                <button
                  type="submit"
                  :class="[
                    active
                      ? 'bg-gray-100 text-gray-900 outline-none'
                      : 'text-gray-700',
                    'block w-full px-4 py-2 text-left text-sm',
                  ]"
                >
                  Sign out
                </button>
              </MenuItem>
            </form>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { ChevronDownIcon, PlusIcon } from "@heroicons/vue/20/solid";
</script>
