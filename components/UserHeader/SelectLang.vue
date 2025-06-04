<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
import { ChevronDownIcon } from "@heroicons/vue/16/solid";
import localToEmoji from "~/utils/localToEmoji";
// import TwemojiText from "../TwemojiText.server.vue";

const { locales, locale: currLocale, setLocale } = useI18n();
</script>

<template>
  <Menu as="div" class="relative inline-block">
    <MenuButton>
      <UserHeaderWidget>
        <div class="inline-flex items-center text-zinc-300 hover:text-white">
          {{ localToEmoji(currLocale) }}
          <!-- <span class="ml-2 text-sm font-bold">{{ locale }}</span> -->
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
          <div class="flex flex-col">
            <MenuItem
              v-for="locale in locales"
              :key="locale.code"
              hydrate-on-visible
              as="div"
            >
              <button @click="setLocale(locale.code)">
                {{ localToEmoji(locale.code) }}
                {{ locale.name }}
              </button>
            </MenuItem>
          </div>
        </PanelWidget>
      </MenuItems>
    </transition>
  </Menu>
</template>
