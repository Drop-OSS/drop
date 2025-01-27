<template>
  <div class="flex items-stretch">
    <button
      type="button"
      @click="addToLibrary"
      :disabled="isProcessing"
      class="inline-flex items-center gap-x-2 rounded-l-md bg-white/10 backdrop-blur px-2.5 py-3 text-base font-semibold font-display text-white shadow-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ isProcessing 
        ? 'Processing...' 
        : isInLibrary 
          ? 'Remove from Library' 
          : 'Add to Library' 
      }}
      <PlusIcon 
        class="-mr-0.5 h-5 w-5" 
        :class="[
          { 'animate-spin': isProcessing },
          { 'rotate-45': isInLibrary }
        ]"
        aria-hidden="true" 
      />
    </button>

    <!-- Collections dropdown -->
    <Menu as="div" class="relative">
      <MenuButton
        class="inline-flex items-center rounded-r-md border-l border-zinc-950/10 bg-white/10 backdrop-blur py-3.5 w-5 justify-center hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20"
      >
        <ChevronDownIcon class="h-5 w-5 text-white" aria-hidden="true" />
      </MenuButton>

      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <MenuItems class="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-md bg-zinc-800/90 backdrop-blur shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div class="p-2">
            <div class="px-3 py-2 text-sm font-semibold text-zinc-400">Collections</div>
            <div v-if="collections.filter(c => !c.isDefault).length === 0" class="px-3 py-2 text-sm text-zinc-500">
              No custom collections available
            </div>
            <MenuItem v-for="collection in collections.filter(c => !c.isDefault)" :key="collection.id" v-slot="{ active }">
              <button
                @click="toggleCollection(collection.id)"
                :class="[
                  active ? 'bg-zinc-700/90' : '',
                  'group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-200'
                ]"
              >
                <span>{{ collection.name }}</span>
                <CheckIcon
                  v-if="collectionStates[collection.id]"
                  class="h-5 w-5 text-blue-400"
                  aria-hidden="true"
                />
              </button>
            </MenuItem>
            <div class="border-t border-zinc-700 mt-1 pt-1">
              <button
                @click="$emit('create-collection')"
                class="group flex w-full items-center px-3 py-2 text-sm text-blue-400 hover:bg-zinc-700/90 rounded-md"
              >
                <PlusIcon class="mr-2 h-4 w-4" />
                Add to new collection
              </button>
            </div>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon, ChevronDownIcon, CheckIcon } from "@heroicons/vue/24/solid";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";

const props = defineProps<{
  gameId: string
  isProcessing: boolean
  isInLibrary: boolean
  collections: Collection[]
  collectionStates: { [key: string]: boolean }
}>();

const emit = defineEmits<{
  'add-to-library': [gameId: string]
  'toggle-collection': [gameId: string, collectionId: string]
  'create-collection': []
}>();

const addToLibrary = () => {
  emit('add-to-library', props.gameId);
};

const toggleCollection = (collectionId: string) => {
  emit('toggle-collection', props.gameId, collectionId);
};
</script>
