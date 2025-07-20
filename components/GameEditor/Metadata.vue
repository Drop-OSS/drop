<!-- eslint-disable vue/no-v-html -->
<template>
  <div v-if="game!">
    <div class="grow flex flex-row gap-y-8">
      <div class="grow w-full h-full px-6 py-4 flex flex-col">
        <div
          class="flex flex-col lg:flex-row lg:justify-between items-start lg:items-center gap-2"
        >
          <div class="inline-flex items-center gap-4">
            <!-- icon image -->
            <img :src="coreMetadataIconUrl" class="size-20" />
            <div>
              <h1 class="text-5xl font-bold font-display text-zinc-100">
                {{ game.mName }}
              </h1>
              <p class="mt-1 text-lg text-zinc-400">
                {{ game.mShortDescription }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="relative inline-flex gap-x-3 items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="() => (showEditCoreMetadata = true)"
          >
            {{ $t("edit") }} <PencilIcon class="size-4" />
          </button>
        </div>

        <!-- image carousel pick -->
        <div class="border-b border-zinc-700">
          <div class="border-b border-zinc-700 py-4">
            <div
              class="-ml-4 -mt-4 flex flex-wrap items-center justify-between sm:flex-nowrap"
            >
              <div class="ml-4 mt-4">
                <h3 class="text-base font-semibold text-zinc-100">
                  {{ $t("library.admin.game.imageCarousel") }}
                </h3>
                <p class="mt-1 text-sm text-zinc-400 max-w-lg">
                  {{ $t("library.admin.game.imageCarouselDescription") }}
                </p>
              </div>
              <div class="ml-4 mt-4 shrink-0">
                <button
                  type="button"
                  class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  @click="() => (showAddCarouselModal = true)"
                >
                  {{ $t("library.admin.game.addImageCarousel") }}
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="game.mImageCarouselObjectIds.length == 0"
            class="text-zinc-400 text-center py-8"
          >
            {{ $t("library.admin.game.imageCarouselEmpty") }}
          </div>

          <draggable
            v-else
            :list="game.mImageCarouselObjectIds"
            class="w-full flex flex-row gap-x-4 overflow-x-auto my-2 py-4"
            @update="() => updateImageCarousel()"
          >
            <template #item="{ element }: { element: string }">
              <div class="relative group min-w-fit">
                <img :src="useObject(element)" class="h-48 w-auto" />
                <div
                  class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    @click="() => removeImageFromCarousel(element)"
                  >
                    {{ $t("library.admin.game.removeImageCarousel") }}
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
            <div>
              <CheckIcon
                v-if="descriptionSaving == DescriptionSavingState.NotLoading"
                class="size-5 text-zinc-100"
              />
              <div
                v-else-if="descriptionSaving == DescriptionSavingState.Waiting"
              >
                <PencilIcon class="animate-pulse size-5 text-zinc-100" />
              </div>
              <div
                v-else-if="descriptionSaving == DescriptionSavingState.Loading"
                role="status"
              >
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
                <span class="sr-only">{{ $t("common.srLoading") }}</span>
              </div>
            </div>

            <button @click="() => (showAddImageDescriptionModal = true)">
              <PhotoIcon
                class="transition size-5 text-zinc-100 hover:text-zinc-300"
              />
            </button>

            <button
              class="block lg:hidden"
              @click="
                () => (mobileShowFinalDescription = !mobileShowFinalDescription)
              "
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
            />
          </div>
        </div>
      </div>
      <div
        class="lg:overflow-y-auto lg:border-l lg:border-zinc-800 lg:block lg:inset-y-0 lg:z-50 lg:w-[30vw] flex flex-col gap-y-8 px-6 py-4"
      >
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
                  {{ $t("library.admin.game.imageLibrary") }}
                </h3>
                <p class="mt-1 text-sm text-zinc-400 max-w-lg">
                  {{ $t("library.admin.game.imageLibraryDescription") }}
                </p>
              </div>
              <div class="flex-shrink-0">
                <button
                  type="button"
                  class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  @click="() => (showUploadModal = true)"
                >
                  {{ $t("upload") }}
                </button>
              </div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 grid-flow-dense gap-8">
            <div
              v-for="(image, imageIdx) in game.mImageLibraryObjectIds"
              :key="imageIdx"
              class="group relative flex items-center bg-zinc-950/30"
            >
              <img :src="useObject(image)" class="w-full h-auto" />
              <div
                class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
              >
                <button
                  v-if="image !== game.mBannerObjectId"
                  type="button"
                  class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  @click="() => updateBannerImage(image)"
                >
                  {{ $t("library.admin.game.setBanner") }}
                </button>
                <button
                  v-if="image !== game.mCoverObjectId"
                  type="button"
                  class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  @click="() => updateCoverImage(image)"
                >
                  {{ $t("library.admin.game.setCover") }}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  @click="() => deleteImage(image)"
                >
                  {{ $t("library.admin.game.deleteImage") }}
                </button>
              </div>
              <div
                v-if="
                  image === game.mBannerObjectId ||
                  image === game.mCoverObjectId
                "
                class="absolute bottom-0 left-0 flex flex-row gap-x-1 p-1"
              >
                <span
                  v-for="[key] of (
                    [
                      [
                        $t('library.admin.game.currentBanner'),
                        image === game.mBannerObjectId,
                      ],
                      [
                        $t('library.admin.game.currentCover'),
                        image === game.mCoverObjectId,
                      ],
                    ] as const
                  ).filter((e) => e[1])"
                  :key="key"
                  class="inline-flex items-center rounded-full bg-blue-900 px-2 py-1 text-xs font-medium text-blue-100"
                  >{{ key }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ModalUploadFile
      v-model="showUploadModal"
      :options="{ id: game.id }"
      accept="image/*"
      endpoint="/api/v1/admin/game/image"
      :multiple="true"
      @upload="(result: Game) => uploadAfterImageUpload(result)"
    />
    <ModalTemplate v-model="showAddCarouselModal">
      <template #default>
        <div
          class="grid grid-cols-2 grid-flow-dense gap-4 max-h-[70vh] overflow-y-auto p-4"
        >
          <div
            v-for="(image, imageIdx) in validAddCarouselImages"
            :key="imageIdx"
            class="group relative flex items-center bg-zinc-950/30"
          >
            <img :src="useObject(image)" class="w-full h-auto" />
            <div
              class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
            >
              <button
                type="button"
                class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                @click="() => addImageToCarousel(image)"
              >
                {{ $t("add") }}
              </button>
            </div>
          </div>
          <div
            v-if="validAddCarouselImages.length == 0"
            class="text-zinc-400 col-span-2"
          >
            {{ $t("library.admin.game.addCarouselNoImages") }}
          </div>
        </div>
      </template>
      <template #buttons>
        <button
          ref="cancelButtonRef"
          type="button"
          class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 sm:mt-0 sm:w-auto"
          @click="showAddCarouselModal = false"
        >
          {{ $t("close") }}
        </button>
      </template>
    </ModalTemplate>
    <ModalTemplate v-model="showAddImageDescriptionModal">
      <template #default>
        <div class="grid grid-cols-2 grid-flow-dense gap-4">
          <div
            v-for="(image, imageIdx) in game.mImageLibraryObjectIds"
            :key="imageIdx"
            class="group relative flex items-center bg-zinc-950/30"
          >
            <img :src="useObject(image)" class="w-full h-auto" />
            <div
              class="transition-all lg:opacity-0 lg:group-hover:opacity-100 absolute inset-0 flex flex-col items-center justify-center gap-y-2 bg-zinc-950/50"
            >
              <button
                type="button"
                class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                @click="() => insertImageAtCursor(image)"
              >
                {{ $t("insert") }}
              </button>
            </div>
          </div>
          <div
            v-if="game.mImageLibraryObjectIds.length == 0"
            class="text-zinc-400 col-span-2"
          >
            {{ $t("library.admin.game.addDescriptionNoImages") }}
          </div>
        </div>
      </template>
      <template #buttons>
        <button
          ref="cancelButtonRef"
          type="button"
          class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 sm:mt-0 sm:w-auto"
          @click="showAddImageDescriptionModal = false"
        >
          {{ $t("cancel") }}
        </button>
      </template>
    </ModalTemplate>
    <ModalTemplate v-model="showEditCoreMetadata">
      <template #default>
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- icon upload div -->
          <div class="flex flex-col items-center gap-4">
            <img :src="coreMetadataIconUrl" class="size-24 aspect-square" />
            <label for="file-upload">
              <span
                type="button"
                class="cursor-pointer relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {{ $t("upload") }}
              </span>
              <input
                id="file-upload"
                accept="image/*"
                class="hidden"
                type="file"
                @change="(e: Event) => coreMetadataUploadFiles(e as any)"
              />
            </label>
          </div>
          <!-- edit title -->
          <div class="flex flex-col gap-y-4 grow">
            <div>
              <label
                for="name"
                class="block text-sm/6 font-medium text-zinc-100"
                >{{ $t("library.admin.game.editGameName") }}</label
              >
              <div class="mt-2">
                <input
                  id="name"
                  v-model="coreMetadataName"
                  type="text"
                  name="name"
                  class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                />
              </div>
            </div>
            <div>
              <label
                for="description"
                class="block text-sm/6 font-medium text-zinc-100"
                >{{ $t("library.admin.game.editGameDescription") }}</label
              >
              <div class="mt-2">
                <input
                  id="description"
                  v-model="coreMetadataDescription"
                  type="text"
                  name="description"
                  class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #buttons>
        <LoadingButton
          type="button"
          :loading="coreMetadataLoading"
          :class="['inline-flex w-full shadow-sm sm:ml-3 sm:w-auto']"
          @click="() => coreMetadataUpdate_wrapper()"
        >
          {{ $t("save") }}
        </LoadingButton>
        <button
          ref="cancelButtonRef"
          type="button"
          class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 sm:mt-0 sm:w-auto"
          @click="showEditCoreMetadata = false"
        >
          {{ $t("cancel") }}
        </button>
      </template>
    </ModalTemplate>
  </div>
</template>

<script setup lang="ts">
import type { Game } from "~/prisma/client";
import { micromark } from "micromark";
import {
  CheckIcon,
  DocumentIcon,
  PencilIcon,
  PhotoIcon,
} from "@heroicons/vue/24/solid";
import type { SerializeObject } from "nitropack";
import type { H3Error } from "h3";

definePageMeta({
  layout: "admin",
});

const showUploadModal = ref(false);
const showAddCarouselModal = ref(false);
const showAddImageDescriptionModal = ref(false);
const showEditCoreMetadata = ref(false);
const mobileShowFinalDescription = ref(true);

const game = defineModel<SerializeObject<Game>>() as Ref<SerializeObject<Game>>;
if (!game.value)
  throw createError({
    statusCode: 500,
    statusMessage: "Game not provided to editor component",
  });

const { t } = useI18n();

// I don't know why I split these fields off.
const coreMetadataName = ref(game.value.mName);
const coreMetadataDescription = ref(game.value.mShortDescription);
const coreMetadataIconUrl = ref(useObject(game.value.mIconObjectId));
const coreMetadataIconFileUpload = ref<FileList | undefined>();
const coreMetadataLoading = ref(false);

function coreMetadataUploadFiles(e: InputEvent) {
  if (coreMetadataIconUrl.value.startsWith("blob")) {
    URL.revokeObjectURL(coreMetadataIconUrl.value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coreMetadataIconFileUpload.value = (e.target as any)?.files;
  const file = coreMetadataIconFileUpload.value?.item(0);
  if (!file) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.upload.title"),
        description: t("errors.upload.description", [t("errors.unknown")]),
        buttonText: t("close"),
      },
      (e, c) => c(),
    );
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  coreMetadataIconUrl.value = objectUrl;
}
async function coreMetadataUpdate() {
  const formData = new FormData();

  const newIcon = coreMetadataIconFileUpload.value?.item(0);
  if (newIcon) {
    formData.append("icon", newIcon);
  }

  formData.append("id", game.value.id);
  formData.append("name", coreMetadataName.value);
  formData.append("description", coreMetadataDescription.value);

  const result = await $dropFetch(`/api/v1/admin/game/metadata`, {
    method: "POST",
    body: formData,
  });
  return result;
}

function coreMetadataUpdate_wrapper() {
  coreMetadataLoading.value = true;
  coreMetadataUpdate()
    .catch((e) => {
      createModal(
        ModalType.Notification,
        {
          title: t("errors.game.metadata.title"),
          description: t("errors.game.metadata.description", [
            (e as H3Error)?.statusMessage ?? t("errors.unknown"),
          ]),
          buttonText: t("close"),
        },
        (e, c) => c(),
      );
    })
    .then((newGame) => {
      console.log(newGame);
      if (!newGame) return;
      Object.assign(game.value, newGame);
      coreMetadataIconUrl.value = useObject(newGame.mIconObjectId);
    })
    .finally(() => {
      coreMetadataLoading.value = false;
      showEditCoreMetadata.value = false;
    });
}

const descriptionHTML = computed(() =>
  micromark(game.value?.mDescription ?? ""),
);
const descriptionEditor = ref<HTMLTextAreaElement | undefined>();
// 0 is not loading
// 1 is waiting for stop
// 2 is loading
enum DescriptionSavingState {
  NotLoading,
  Waiting,
  Loading,
}
const descriptionSaving = ref<DescriptionSavingState>(
  DescriptionSavingState.NotLoading,
);

let savingTimeout: undefined | NodeJS.Timeout;

type PatchGameBody = Partial<Game>;

watch(descriptionHTML, (_v) => {
  descriptionSaving.value = DescriptionSavingState.Waiting;
  if (savingTimeout) clearTimeout(savingTimeout);
  savingTimeout = setTimeout(async () => {
    try {
      descriptionSaving.value = DescriptionSavingState.Loading;
      await $dropFetch("/api/v1/admin/game", {
        method: "PATCH",
        body: {
          id: game.value.id,
          mDescription: game.value.mDescription,
        } satisfies PatchGameBody,
      });
      descriptionSaving.value = DescriptionSavingState.NotLoading;
    } catch (e) {
      createModal(
        ModalType.Notification,
        {
          title: t("errors.game.description.title"),
          description: t("errors.game.description.description", [
            (e as H3Error)?.statusMessage ?? t("errors.unknown"),
          ]),
          buttonText: t("close"),
        },
        (e, c) => c(),
      );
    }
  }, 1500);
});

const validAddCarouselImages = computed(() =>
  game.value.mImageLibraryObjectIds.filter(
    (e) => !game.value.mImageCarouselObjectIds.includes(e),
  ),
);

function insertImageAtCursor(id: string) {
  showAddImageDescriptionModal.value = false;
  if (!descriptionEditor.value || !game.value) return;
  const insertPosition = descriptionEditor.value.selectionStart;
  const text = `![](/api/v1/object/${id})`;
  game.value.mDescription = `${game.value.mDescription.slice(
    0,
    insertPosition,
  )}${text}${game.value.mDescription.slice(insertPosition)}`;
}

async function updateBannerImage(id: string) {
  try {
    if (game.value.mBannerObjectId == id) return;
    const { mBannerObjectId } = await $dropFetch("/api/v1/admin/game", {
      method: "PATCH",
      body: {
        id: game.value.id,
        mBannerObjectId: id,
      } satisfies PatchGameBody,
    });
    game.value.mBannerObjectId = mBannerObjectId;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.game.banner.title"),
        description: t("errors.game.banner.description", [
          (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        ]),
        buttonText: t("close"),
      },
      (e, c) => c(),
    );
  }
}

async function updateCoverImage(id: string) {
  try {
    if (game.value.mCoverObjectId == id) return;
    const { mCoverObjectId } = await $dropFetch("/api/v1/admin/game", {
      method: "PATCH",
      body: {
        id: game.value.id,
        mCoverObjectId: id,
      } satisfies PatchGameBody,
    });
    game.value.mCoverObjectId = mCoverObjectId;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.game.cover.title"),
        description: t("errors.game.cover.description", [
          (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        ]),
        buttonText: t("close"),
      },
      (e, c) => c(),
    );
  }
}

async function deleteImage(id: string) {
  try {
    const { mBannerObjectId, mImageLibraryObjectIds } = await $dropFetch(
      "/api/v1/admin/game/image",
      {
        method: "DELETE",
        body: {
          gameId: game.value.id,
          imageId: id,
        },
      },
    );
    game.value.mImageLibraryObjectIds = mImageLibraryObjectIds;
    game.value.mBannerObjectId = mBannerObjectId;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.game.deleteImage.title"),
        description: t("errors.game.deleteImage.description", [
          (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        ]),
        buttonText: t("close"),
      },
      (e, c) => c(),
    );
  }
}

async function uploadAfterImageUpload(result: Game) {
  if (!game.value) return;
  game.value.mImageLibraryObjectIds = result.mImageLibraryObjectIds;
}

function addImageToCarousel(id: string) {
  game.value.mImageCarouselObjectIds.push(id);
  updateImageCarousel();
}

function removeImageFromCarousel(id: string) {
  const imageIndex = game.value.mImageCarouselObjectIds.findIndex(
    (e) => e == id,
  );
  game.value.mImageCarouselObjectIds.splice(imageIndex, 1);
  updateImageCarousel();
}

async function updateImageCarousel() {
  try {
    await $dropFetch("/api/v1/admin/game", {
      method: "PATCH",
      body: {
        id: game.value.id,
        mImageCarouselObjectIds: game.value.mImageCarouselObjectIds,
      } satisfies PatchGameBody,
    });
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.game.carousel.title"),
        description: t("errors.game.carousel.description", [
          (e as H3Error)?.statusMessage ?? t("errors.unknown"),
        ]),
        buttonText: t("close"),
      },
      (e, c) => c(),
    );
  }
}
</script>
