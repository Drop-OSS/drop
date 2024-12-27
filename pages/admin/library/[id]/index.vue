<template>
  <div
    v-if="game && unimportedVersions !== undefined"
    class="grow flex flex-col gap-y-8"
  >
    <div class="grow w-full h-full lg:pr-[30vw] px-6 py-4 flex flex-col">
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
            <div class="relative group min-w-fit">
              <img :src="useObject(element)" class="h-48 w-auto" />
              <div
                class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
              >
                <button
                  @click="() => removeImageFromCarousel(element)"
                  type="button"
                  class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Remove image
                </button>
              </div>
            </div>
          </template>
        </draggable>
      </div>

      <!-- description editor -->
      <div
        class="mt-4 grow flex flex-col w-full space-y-4 border border-zinc-800 rounded overflow-hidden p-2"
      >
        <!-- toolbar -->
        <div
          class="h-8 bg-zinc-800 rounded inline-flex gap-x-4 items-center justify-start p-2"
        >
          <button>
            <CheckIcon
              v-if="descriptionSaving == 0"
              class="size-5 text-zinc-100"
            />
            <div v-else-if="descriptionSaving == 1">
              <div class="animate-pulse w-5 h-[3px] bg-zinc-100 rounded-full" />
            </div>
            <div v-else-if="descriptionSaving == 2" role="status">
              <svg
                aria-hidden="true"
                class="w-5 h-5 text-transparent animate-spin fill-white"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span class="sr-only">Loading...</span>
            </div>
          </button>

          <button @click="() => (showAddImageDescriptionModal = true)">
            <PhotoIcon
              class="transition size-5 text-zinc-100 hover:text-zinc-300"
            />
          </button>

          <button
            @click="
              () => (mobileShowFinalDescription = !mobileShowFinalDescription)
            "
            class="block lg:hidden"
          >
            <DocumentIcon
              v-if="!mobileShowFinalDescription"
              class="transition size-5 text-zinc-100 hover:text-zinc-300"
            />
            <PencilIcon
              v-else
              class="transition size-5 text-zinc-100 hover:text-zinc-300"
            />
          </button>
        </div>
        <!-- edit area -->
        <div class="grid lg:grid-cols-2 lg:gap-x-8 grow">
          <!-- editing box -->
          <div
            :class="[
              mobileShowFinalDescription ? 'hidden' : 'block',
              'lg:block',
            ]"
          >
            <textarea
              ref="descriptionEditor"
              v-model="game.mDescription"
              class="grow h-full w-full bg-zinc-950/30 text-zinc-100 border-zinc-900 rounded"
            />
          </div>
          <!-- result box -->
          <div
            :class="[
              mobileShowFinalDescription ? 'block' : 'hidden',
              'lg:block prose prose-invert prose-blue bg-zinc-950/30 rounded px-4 py-3',
            ]"
            v-html="descriptionHTML"
          ></div>
        </div>
      </div>
    </div>
    <div
      class="lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:fixed lg:inset-y-0 lg:z-50 lg:w-[30vw] flex flex-col lg:right-0 gap-y-8 px-6 py-4"
    >
      <!-- toolbar -->
      <div class="inline-flex justify-end items-stretch gap-x-4">
        <!-- import games button -->
        <NuxtLink
          :href="
            unimportedVersions.length > 0
              ? `/admin/library/${game.id}/import`
              : ''
          "
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
            class="flex flex-wrap items-center justify-between sm:flex-nowrap gap-4"
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
              class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
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
            class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
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
  <ModalTemplate v-model="showAddImageDescriptionModal">
    <template #default>
      <div class="mt-3 grid grid-cols-2 grid-flow-dense gap-4">
        <div
          v-for="(image, imageIdx) in game.mImageLibrary"
          :key="image"
          class="group relative flex items-center bg-zinc-950/30"
        >
          <img :src="useObject(image)" class="w-full h-auto" />
          <div
            class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
          >
            <button
              @click="() => insertImageAtCursor(image)"
              type="button"
              class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Insert
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
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  DocumentIcon,
  PencilIcon,
  PhotoIcon,
} from "@heroicons/vue/24/solid";

definePageMeta({
  layout: "admin",
});

const showUploadModal = ref(false);
const showAddCarouselModal = ref(false);
const showAddImageDescriptionModal = ref(false);
const mobileShowFinalDescription = ref(true);

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

const descriptionHTML = computed(() =>
  micromark(game.value?.mDescription ?? "")
);
const descriptionEditor = ref<HTMLTextAreaElement | undefined>();
// 0 is not loading
// 1 is waiting for stop
// 2 is loading
const descriptionSaving = ref<number>(0);

let savingTimeout: undefined | NodeJS.Timeout;

watch(descriptionHTML, (v) => {
  console.log(game.value.mDescription);
  descriptionSaving.value = 1;
  if (savingTimeout) clearTimeout(savingTimeout);
  savingTimeout = setTimeout(async () => {
    try {
      descriptionSaving.value = 2;
      await $fetch("/api/v1/admin/game", {
        method: "PATCH",
        body: {
          id: gameId,
          mDescription: game.value.mDescription,
        },
      });
      descriptionSaving.value = 0;
    } catch (e: any) {
      createModal(
        ModalType.Notification,
        {
          title: "Failed to update game description",
          description: `Drop failed to update the game description: ${
            e?.statusMessage || "An unknown error occurred."
          }`,
          buttonText: "Close",
        },
        (e, c) => c()
      );
    }
  }, 1500);
});

function insertImageAtCursor(id: string) {
  showAddImageDescriptionModal.value = false;
  if (!descriptionEditor.value || !game.value) return;
  const insertPosition = descriptionEditor.value.selectionStart;
  const text = `![](/api/v1/object/${id})`;
  game.value.mDescription = `${game.value.mDescription.slice(
    0,
    insertPosition
  )}${text}${game.value.mDescription.slice(insertPosition)}`;
}

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
  showAddCarouselModal.value = false;
  game.value.mImageCarousel.push(id);
  updateImageCarousel();
}

function removeImageFromCarousel(id: string) {
  const imageIndex = game.value.mImageCarousel.findIndex((e) => e == id);
  game.value.mImageCarousel.splice(imageIndex, 1);
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
