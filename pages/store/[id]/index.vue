<template>
  <div
    class="mx-auto bg-zinc-950 w-full relative flex flex-col justify-center pt-32 xl:pt-24 z-10 overflow-hidden"
  >
    <!-- banner image -->
    <div class="absolute flex top-0 h-fit inset-x-0 h-12 -z-[20] pb-4">
      <img :src="useObject(game.mBannerId)" class="blur-sm w-full h-auto" />
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent to-80% to-zinc-950"
      />
    </div>
    <!-- main page -->
    <div
      :class="[
        'max-w-7xl w-full min-h-screen mx-auto px-5 py-4 sm:px-16 sm:py-12 rounded-xl', // layout stuff
        'bg-zinc-950/90 backdrop-blur-[500px] backdrop-saturate-200 backdrop-brightness-200', // make a soft, colourful glow background
      ]"
    >
      <h1
        class="text-3xl md:text-5xl font-bold font-display text-zinc-100 pb-4 border-b border-zinc-800"
      >
        {{ game.mName }}
      </h1>

      <div class="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div
          class="col-start-1 lg:col-start-4 flex flex-col gap-y-6 items-center"
        >
          <img
            class="transition-all duration-300 hover:scale-105 hover:rotate-[-1deg] w-64 h-auto rounded"
            :src="useObject(game.mCoverId)"
          />
          <div class="flex items-center gap-x-2">
            <AddLibraryButton
              :gameId="game.id"
              :isProcessing="isAddingToLibrary"
              :isInLibrary="isInLibrary"
              :collections="collections"
              :collectionStates="collectionStates"
              @add-to-library="addToLibrary"
              @toggle-collection="toggleCollection"
              @create-collection="showCreateCollectionModal = true"
            />
          </div>
          <NuxtLink
            v-if="user?.admin"
            :href="`/admin/library/${game.id}`"
            type="button"
            class="inline-flex items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Open in Admin Dashboard
            <ArrowTopRightOnSquareIcon
              class="-mr-0.5 h-7 w-7 p-1"
              aria-hidden="true"
            />
          </NuxtLink>
          <table class="min-w-full">
            <tbody>
              <tr>
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
                >
                  Released
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ moment(game.mReleased).format("Do MMMM, YYYY") }}
                </td>
              </tr>
              <tr>
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
                >
                  Platform(s)
                </td>
                <td
                  class="whitespace-nowrap inline-flex gap-x-4 px-3 py-4 text-sm text-zinc-400"
                >
                  <component
                    v-for="platform in platforms"
                    :is="PLATFORM_ICONS[platform]"
                    class="text-blue-600 w-6 h-6"
                  />
                  <span
                    v-if="platforms.length == 0"
                    class="font-semibold text-blue-600"
                    >coming soon</span
                  >
                </td>
              </tr>
              <tr>
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
                >
                  Rating
                </td>
                <td
                  class="whitespace-nowrap flex flex-row items-center gap-x-1 px-3 py-4 text-sm text-zinc-400"
                >
                  <StarIcon
                    v-for="value in ratingArray"
                    :class="[
                      value ? 'text-yellow-600' : 'text-zinc-600',
                      'w-4 h-4',
                    ]"
                  />
                  <span class="text-zinc-600"
                    >({{ game.mReviewCount }} reviews)</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="row-start-2 lg:row-start-1 lg:col-span-3">
          <p class="text-lg text-zinc-400">
            {{ game.mShortDescription }}
          </p>
          <div class="mt-6 py-4 rounded">
            <VueCarousel :items-to-show="1">
              <VueSlide v-for="image in game.mImageCarousel" :key="image">
                <img
                  class="w-fit h-48 lg:h-96 rounded"
                  :src="useObject(image)"
                />
              </VueSlide>
              <VueSlide v-if="game.mImageCarousel.length == 0">
                <div class="h-48 lg:h-96 aspect-[1/2] flex items-center justify-center text-zinc-700 font-bold font-display">
                  No images
                </div>
              </VueSlide>

              <template #addons>
                <VueNavigation />
                <CarouselPagination class="py-2 px-12" />
              </template>
            </VueCarousel>
          </div>

          <div>
            <div
              v-if="showPreview"
              v-html="previewHTML"
              class="mt-12 prose prose-invert prose-blue max-w-none"
            />
            <div
              v-else
              v-html="descriptionHTML"
              class="mt-12 prose prose-invert prose-blue max-w-none"
            />

            <button
              v-if="showReadMore"
              class="mt-8 w-full inline-flex items-center gap-x-6"
              @click="() => (showPreview = !showPreview)"
            >
              <div class="grow h-[1px] bg-zinc-700 rounded-full" />
              <span
                class="uppercase text-sm font-semibold font-display text-zinc-600"
                >Click to read {{ showPreview ? "more" : "less" }}</span
              >
              <div class="grow h-[1px] bg-zinc-700 rounded-full" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add this modal at the end of the template -->
    <CreateCollectionModal
      :show="showCreateCollectionModal"
      :gameId="game.id"
      @close="showCreateCollectionModal = false"
      @created="handleCollectionCreated"
    />

    <!-- Delete Collection Confirmation Modal -->
    <DeleteCollectionModal
      :show="showDeleteModal"
      :collection="collectionToDelete"
      @close="showDeleteModal = false"
      @deleted="handleCollectionDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { IconsLinuxLogo, IconsWindowsLogo } from "#components";
import { PlusIcon, EllipsisVerticalIcon, TrashIcon, ChevronDownIcon } from "@heroicons/vue/20/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/outline";
import { StarIcon, CheckIcon } from "@heroicons/vue/24/solid";
import { type Game, type GameVersion } from "@prisma/client";
import { micromark } from "micromark";
import moment from "moment";
import { PlatformClient } from "~/composables/types";
import { ref, onMounted } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
import { TransitionRoot, Dialog, DialogPanel, DialogTitle, TransitionChild } from "@headlessui/vue";
import AddLibraryButton from "~/components/AddLibraryButton.vue";
import CreateCollectionModal from "~/components/CreateCollectionModal.vue";
import DeleteCollectionModal from "~/components/DeleteCollectionModal.vue";

const route = useRoute();
const gameId = route.params.id.toString();

const user = useUser();

const headers = useRequestHeaders(["cookie"]);
const game = await $fetch<Game & { versions: GameVersion[] }>(
  `/api/v1/games/${gameId}`,
  { headers }
);

// Preview description (first 30 lines)
const showPreview = ref(true);
const gameDescriptionCharacters = game.mDescription.split("");

// First new line after x characters
const descriptionSplitIndex = gameDescriptionCharacters.findIndex(
  (v, i, arr) => {
    // If we're at the last element, we return true.
    // So we don't have to handle a -1 from this findIndex
    if (i + 1 == arr.length) return true;
    if (i < 500) return false;
    if (v != "\n") return false;
    return true;
  }
);

const previewDescription = gameDescriptionCharacters
  .slice(0, descriptionSplitIndex + 1) // Slice a character after
  .join("");
const previewHTML = micromark(previewDescription);

const descriptionHTML = micromark(game.mDescription);

const showReadMore = previewHTML != descriptionHTML;
const platforms = game.versions
  .map((e) => e.platform as PlatformClient)
  .flat()
  .filter((e, i, u) => u.indexOf(e) === i);

const rating = Math.round(game.mReviewRating * 5);
const ratingArray = Array(5)
  .fill(null)
  .map((_, i) => i + 1 <= rating);

const isAddingToLibrary = ref(false);

const collections = ref<Collection[]>([]);
const collectionStates = ref<{ [key: string]: boolean }>({});
const isInLibrary = ref(false);

const showCreateCollectionModal = ref(false);
const newCollectionName = ref('');
const isCreatingCollection = ref(false);

const showDeleteModal = ref(false)
const collectionToDelete = ref<Collection | null>(null)

onMounted(async () => {
  try {
    // Fetch collections with their entries
    collections.value = await $fetch<Collection[]>('/api/v1/collection', { headers })
    
    // Check which collections have this game
    for (const collection of collections.value) {
      const hasGame = collection.entries?.some(entry => entry.gameId === game.id)
      collectionStates.value[collection.id] = !!hasGame
      // If it's in the default collection, update isInLibrary
      if (collection.isDefault && hasGame) {
        isInLibrary.value = true
      }
    }
  } catch (error) {
    console.error('Failed to fetch collections:', error)
  }
});

const toggleCollection = async (collectionId: string) => {
  try {
    if (collectionStates.value[collectionId]) {
      // Remove from collection
      await $fetch(`/api/v1/collection/${collectionId}/entry`, {
        method: 'DELETE',
        body: { id: game.id }
      })
    } else {
      // Add to collection
      await $fetch(`/api/v1/collection/${collectionId}/entry`, {
        method: 'POST',
        body: { id: game.id }
      })
    }
    // Toggle state
    collectionStates.value[collectionId] = !collectionStates.value[collectionId]
  } catch (error) {
    console.error('Failed to toggle collection:', error)
  }
}

const addToLibrary = async () => {
  if (isAddingToLibrary.value) return;
  
  try {
    isAddingToLibrary.value = true;
    const defaultCollection = collections.value.find(c => c.isDefault);
    if (!defaultCollection) return;

    if (isInLibrary.value) {
      // Remove from library
      await $fetch(`/api/v1/collection/${defaultCollection.id}/entry`, {
        method: "DELETE",
        body: { id: game.id }
      });
    } else {
      // Add to library
      await $fetch(`/api/v1/collection/default/entry`, {
        method: "POST",
        body: { id: game.id }
      });
    }
    // Toggle state
    isInLibrary.value = !isInLibrary.value;
  } catch (error) {
    console.error("Failed to modify library:", error);
  } finally {
    isAddingToLibrary.value = false;
  }
};

const handleCollectionCreated = async (collectionId: string) => {
  // Refresh collections
  collections.value = await $fetch<Collection[]>('/api/v1/collection', { headers });
  // Set initial state for the new collection
  collectionStates.value[collectionId] = true;
};

const handleCollectionDeleted = (collectionId: string) => {
  collections.value = collections.value.filter(c => c.id !== collectionId);
  collectionToDelete.value = null;
};

useHead({
  title: game.mName,
});
</script>
