<template>
  <div
    v-if="game && unimportedVersions !== undefined"
    class="flex flex-col lg:block gap-y-8"
  >
    <div class="w-full lg:pr-[30vw] px-6 py-4">
      <h1 class="text-5xl font-bold font-display text-zinc-100">
        {{ game.mName }}
      </h1>
      <p class="mt-1 text-lg text-zinc-400">
        {{ game.mShortDescription }}
      </p>

      <!-- image carousel pick -->
      <div class="border-b border-zinc-700">
        <div class="border-b border-zinc-700 py-4">
          <div
            class="-ml-4 -mt-4 flex flex-wrap items-center justify-between sm:flex-nowrap"
          >
            <div class="ml-4 mt-4">
              <h3 class="text-base font-semibold text-zinc-100">
                Image Carousel
              </h3>
              <p class="mt-1 text-sm text-zinc-400 max-w-lg">
                Customise what images and what order are shown on the store
                page.
              </p>
            </div>
            <div class="ml-4 mt-4 shrink-0">
              <button
                @click="() => (showAddCarouselModal = true)"
                type="button"
                class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Add from image library
              </button>
            </div>
          </div>
        </div>
        <div
          class="text-zinc-400 text-center py-8"
          v-if="game.mImageCarousel.length == 0"
        >
          No images added to the carousel yet.
        </div>

        <draggable
          v-else
          @update="() => updateImageCarousel()"
          :list="game.mImageCarousel"
          class="w-full flex flex-row gap-x-4 overflow-x-auto my-2 py-4"
        >
          <template #item="{ element }: { element: string }">
            <img :src="useObject(element)" class="h-48 w-auto" />
          </template>
        </draggable>
      </div>

      <div v-html="descriptionHTML" class="mt-8 prose prose-invert prose-blue"></div>
    </div>
    <div
      class="lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:fixed lg:inset-y-0 lg:z-50 lg:w-[30vw] flex flex-col lg:right-0 gap-y-8 px-6 py-4"
    >
      <!-- toolbar -->
      <div class="inline-flex justify-end items-stretch gap-x-4">
        <!-- import games button -->
        <NuxtLink
          :href="unimportedVersions.length > 0 ? `/store/${game.id}` : ''"
          type="button"
          :class="[
            unimportedVersions.length > 0
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-blue-800/50',
            'inline-flex w-fit items-center gap-x-2 rounded-md  px-3 py-1 text-sm font-semibold font-display text-white shadow-sm  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
          ]"
        >
          {{
            unimportedVersions.length > 0
              ? "Import version"
              : "No versions to import"
          }}
        </NuxtLink>
        <!-- open in store button -->
        <NuxtLink
          :href="`/store/${game.id}`"
          type="button"
          class="inline-flex w-fit items-center gap-x-2 rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold font-display text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Open in Store
          <ArrowTopRightOnSquareIcon
            class="-mr-0.5 h-7 w-7 p-1"
            aria-hidden="true"
          />
        </NuxtLink>
      </div>

      <!-- image library -->
      <div>
        <div class="border-b border-zinc-800 pb-3">
          <div
            class="flex flex-wrap items-center justify-between sm:flex-nowrap"
          >
            <div>
              <h3
                class="text-base font-semibold font-display leading-6 text-zinc-100"
              >
                Image library
              </h3>
              <p class="mt-1 text-sm text-zinc-400 max-w-lg">
                Please note all images uploaded are accessible to all users
                through browser dev-tools.
              </p>
            </div>
            <div class="flex-shrink-0">
              <button
                @click="() => (showUploadModal = true)"
                type="button"
                class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 grid-flow-dense gap-8">
          <div
            v-for="(image, imageIdx) in game.mImageLibrary"
            :key="image"
            class="group relative flex items-center bg-zinc-950/30"
          >
            <img :src="useObject(image)" class="w-full h-auto" />
            <div
              class="transition-all opacity-0 group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
            >
              <button
                v-if="image !== game.mBannerId"
                @click="() => updateBannerImage(image)"
                type="button"
                class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Set as banner
              </button>
              <button
                v-if="image !== game.mCoverId"
                @click="() => updateCoverImage(image)"
                type="button"
                class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Set as cover
              </button>
              <button
                @click="() => deleteImage(image)"
                type="button"
                class="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Delete image
              </button>
            </div>
            <div
              v-if="image === game.mBannerId || image === game.mCoverId"
              class="absolute bottom-0 left-0 bg-zinc-950/75 text-zinc-100 text-sm font-semibold px-2 py-1 rounded-tr"
            >
              current
              {{
                [
                  image === game.mBannerId ? "banner" : undefined,
                  image === game.mCoverId ? "cover" : undefined,
                ]
                  .filter((e) => e)
                  .join(" & ")
              }}
            </div>
          </div>
        </div>
      </div>
      <!-- version priority -->
      <div>
        <div class="border-b border-zinc-800 pb-3">
          <div
            class="flex flex-wrap items-center justify-between sm:flex-nowrap"
          >
            <h3
              class="text-base font-semibold font-display leading-6 text-zinc-100"
            >
              Version priority
            </h3>
          </div>
        </div>

        <div class="mt-4 text-center w-full text-sm text-zinc-600">lowest</div>
        <draggable
          @update="() => updateVersionOrder()"
          :list="game.versions"
          handle=".handle"
          class="mt-2 space-y-4"
        >
          <template #item="{ element: item }: { element: GameVersion }">
            <div
              class="w-full inline-flex items-center px-4 py-2 bg-zinc-800 rounded justify-between"
            >
              <div class="text-zinc-100 font-semibold">
                {{ item.versionName }}
              </div>
              <div class="text-zinc-400">
                {{ item.delta ? "Upgrade mode" : "" }}
              </div>
              <div class="inline-flex gap-x-2">
                <Bars3Icon class="cursor-move w-6 h-6 text-zinc-400 handle" />
                <button @click="() => deleteVersion(item.versionName)">
                  <TrashIcon class="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
          </template>
        </draggable>
        <div
          class="text-center font-bold text-zinc-400 my-3"
          v-if="game.versions.length == 0"
        >
          no versions added
        </div>
        <div class="mt-2 text-center w-full text-sm text-zinc-600">highest</div>
      </div>
    </div>
  </div>
  <UploadFileDialog
    v-model="showUploadModal"
    :options="{ id: game.id }"
    accept="image/*"
    endpoint="/api/v1/admin/game/image"
    @upload="(result) => uploadAfterImageUpload(result)"
  />
  <ModalTemplate v-model="showAddCarouselModal">
    <template #default>
      <div class="mt-3 grid grid-cols-2 grid-flow-dense gap-4">
        <div
          v-for="(image, imageIdx) in game.mImageLibrary.filter(
            (e) => !game.mImageCarousel.includes(e)
          )"
          :key="image"
          class="group relative flex items-center bg-zinc-950/30"
        >
          <img :src="useObject(image)" class="w-full h-auto" />
          <div
            class="transition-all opacity-0 group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
          >
            <button
              @click="() => addImageToCarousel(image)"
              type="button"
              class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <button
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 sm:mt-0 sm:w-auto"
        @click="showAddCarouselModal = false"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { Bars3Icon, TrashIcon } from "@heroicons/vue/16/solid";
import type { Game, GameVersion } from "@prisma/client";
import { micromark } from "micromark";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/24/solid";

definePageMeta({
  layout: "admin",
});

const showUploadModal = ref(false);
const showAddCarouselModal = ref(false);

const route = useRoute();
const gameId = route.params.id.toString();
const headers = useRequestHeaders(["cookie"]);
const { game: rawGame, unimportedVersions } = await $fetch(
  `/api/v1/admin/game?id=${encodeURIComponent(gameId)}`,
  {
    headers,
  }
);
const game = ref(rawGame);

const descriptionHTML = micromark(game.value?.mDescription ?? "");

async function updateBannerImage(id: string) {
  try {
    if (game.value.mBannerId == id) return;
    const { mBannerId } = await $fetch("/api/v1/admin/game", {
      method: "PATCH",
      body: {
        id: gameId,
        mBannerId: id,
      },
    });
    game.value.mBannerId = mBannerId;
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while updating the banner image",
        description: `Drop encountered an error while updating the banner image: ${
          e?.statusMessage || "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  }
}

async function updateCoverImage(id: string) {
  try {
    if (game.value.mCoverId == id) return;
    const { mCoverId } = await $fetch("/api/v1/admin/game", {
      method: "PATCH",
      body: {
        id: gameId,
        mCoverId: id,
      },
    });
    game.value.mCoverId = mCoverId;
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while updating the cover image",
        description: `Drop encountered an error while updating the cover image: ${
          e?.statusMessage || "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  }
}

async function deleteImage(id: string) {
  try {
    const { mBannerId, mImageLibrary } = await $fetch(
      "/api/v1/admin/game/image",
      {
        method: "DELETE",
        body: {
          gameId: game.value.id,
          imageId: id,
        },
      }
    );
    game.value.mImageLibrary = mImageLibrary;
    game.value.mBannerId = mBannerId;
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while deleting the image",
        description: `Drop encountered an error while deleting the image: ${
          e?.statusMessage || "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  }
}

async function uploadAfterImageUpload(result: Game) {
  if (!game.value) return;
  game.value.mImageLibrary = result.mImageLibrary;
}

async function deleteVersion(versionName: string) {
  try {
    await $fetch("/api/v1/admin/game/version", {
      method: "DELETE",
      body: {
        id: gameId,
        versionName: versionName,
      },
    });
    game.value.versions.splice(
      game.value.versions.findIndex((e) => e.versionName === versionName),
      1
    );
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while deleting the version",
        description: `Drop encountered an error while deleting the version: ${
          e?.statusMessage || "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  }
}

async function updateVersionOrder() {
  try {
    const newVersions = await $fetch("/api/v1/admin/game/version", {
      method: "POST",
      body: {
        id: gameId,
        versions: game.value.versions.map((e) => e.versionName),
      },
    });
    game.value.versions = newVersions;
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while updating the version order",
        description: `Drop encountered an error while updating the version: ${
          e?.statusMessage || "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  }
}

function addImageToCarousel(id: string) {
  game.value.mImageCarousel.push(id);
  showAddCarouselModal.value = false;
  updateImageCarousel();
}

async function updateImageCarousel() {
  try {
    await $fetch("/api/v1/admin/game", {
      method: "PATCH",
      body: {
        id: gameId,
        mImageCarousel: game.value.mImageCarousel,
      },
    });
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "There an error while updating the image carousel",
        description: `Drop encountered an error while updating image carousel: ${
          e?.statusMessage || "An unknown error occurred"
        }`,
        buttonText: "Close",
      },
      (e, c) => c()
    );
  }
}
</script>
