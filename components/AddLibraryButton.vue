<template>
  <div class="inline-flex group hover:scale-105 transition-all duration-200">
    <LoadingButton
      :loading="isLibraryLoading"
      @click="() => toggleLibrary()"
      :style="'none'"
      class="transition w-48 inline-flex items-center justify-center h-full gap-x-2 rounded-none rounded-l-md bg-white/10 hover:bg-white/20 text-zinc-100 backdrop-blur px-5 py-3 active:scale-95"
    >
      {{ inLibrary ? "In Library" : "Add to Library" }}
      <CheckIcon v-if="inLibrary" class="-mr-0.5 h-5 w-5" aria-hidden="true" />
      <PlusIcon v-else class="-mr-0.5 h-5 w-5" aria-hidden="true" />
    </LoadingButton>

    <!-- Collections dropdown -->
    <Menu as="div" class="relative">
      <MenuButton
        as="div"
        class="transition cursor-pointer inline-flex items-center rounded-r-md h-full ml-[2px] bg-white/10 hover:bg-white/20 backdrop-blur py-3.5 px-2 justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20"
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
        <MenuItems
          class="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-md bg-zinc-800/90 backdrop-blur shadow-lg focus:outline-none"
        >
          <div class="p-2">
            <div
              class="font-display uppercase px-3 py-2 text-sm font-semibold text-zinc-500"
            >
              Collections
            </div>
            <div
              class="flex flex-col gap-y-2 py-1 max-h-[150px] overflow-y-auto"
            >
              <div
                v-if="collections.length === 0"
                class="px-3 py-2 text-sm text-zinc-500"
              >
                No collections
              </div>
              <MenuItem
                v-for="(collection, collectionIdx) in collections"
                :key="collection.id"
                v-slot="{ active }"
              >
                <button
                  :class="[
                    active ? 'bg-zinc-700/90' : '',
                    'group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-200',
                  ]"
                  @click="() => toggleCollection(collection.id)"
                >
                  <span>{{ collection.name }}</span>
                  <CheckIcon
                    v-if="inCollections[collectionIdx]"
                    class="h-5 w-5 text-blue-400"
                    aria-hidden="true"
                  />
                </button>
              </MenuItem>
            </div>
            <div class="border-t border-zinc-700 pt-1">
              <LoadingButton
                :loading="false"
                @click="createCollectionModal = true"
                class="w-full"
              >
                <PlusIcon class="mr-2 h-4 w-4" />
                Add to new collection
              </LoadingButton>
            </div>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </div>

  <CreateCollectionModal
    v-model="createCollectionModal"
    :gameId="props.gameId"
  />
</template>

<script setup lang="ts">
import { PlusIcon, ChevronDownIcon, CheckIcon } from "@heroicons/vue/24/solid";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";

const props = defineProps<{
  gameId: string;
}>();

const isLibraryLoading = ref(false);

const createCollectionModal = ref(false);
const collections = await useCollections();
const library = await useLibrary();

const inLibrary = computed(
  () => library.value.entries.findIndex((e) => e.gameId == props.gameId) != -1
);
const inCollections = computed(() =>
  collections.value.map(
    (e) => e.entries.findIndex((e) => e.gameId == props.gameId) != -1
  )
);

async function toggleLibrary() {
  isLibraryLoading.value = true;
  try {
    await $fetch("/api/v1/collection/default/entry", {
      method: inLibrary.value ? "DELETE" : "POST",
      body: {
        id: props.gameId,
      },
    });
    await refreshLibrary();
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to add game to library",
        description: `Drop couldn't add this game to your library: ${e?.statusMessage}`,
      },
      (_, c) => c()
    );
  } finally {
    isLibraryLoading.value = false;
  }
}

async function toggleCollection(id: string) {
  try {
    const collection = collections.value.find((e) => e.id == id);
    if (!collection) return;
    const index = collection.entries.findIndex((e) => e.gameId == props.gameId);

    await $fetch(`/api/v1/collection/${id}/entry`, {
      method: index == -1 ? "POST" : "DELETE",
      body: {
        id: props.gameId,
      },
    });

    await refreshCollection(id);
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to add game to library",
        description: `Drop couldn't add this game to your library: ${e?.statusMessage}`,
      },
      (_, c) => c()
    );
  } finally {
  }
}
</script>
