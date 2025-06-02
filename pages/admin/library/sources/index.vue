<template>
  <div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">Library Sources</h1>
        <p class="mt-2 text-sm text-zinc-400">
          Configure your library sources, where Drop will look for new games and
          versions to import.
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="() => (actionSourceOpen = true)"
        >
          Create
        </button>
      </div>
    </div>
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table class="min-w-full divide-y divide-zinc-700">
            <thead>
              <tr>
                <th
                  scope="col"
                  class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-3"
                >
                  Name
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Type
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Working?
                </th>
                <th
                  scope="col"
                  class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
                >
                  Options
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-3">
                  <span class="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(source, sourceIdx) in sources"
                :key="source.id"
                class="even:bg-zinc-800"
              >
                <td
                  class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
                >
                  {{ source.name }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ source.backend }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  <CheckIcon
                    v-if="source.working"
                    class="size-5 text-green-500"
                  />
                  <XMarkIcon v-else class="size-5 text-red-500" />
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                  {{ source.options }}
                </td>
                <td
                  class="relative whitespace-nowrap py-4 pl-3 pr-3 text-right text-sm font-medium space-x-2"
                >
                  <button
                    class="text-blue-500 hover:text-blue-400"
                    @click="() => edit(sourceIdx)"
                  >
                    Edit<span class="sr-only">, {{ source.name }}</span>
                  </button>

                  <button
                    class="text-red-500 hover:text-red-400"
                    @click="() => deleteSource(sourceIdx)"
                  >
                    Delete<span class="sr-only">, {{ source.name }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <ModalTemplate v-model="actionSourceOpen">
      <template #default>
        <div>
          <DialogTitle as="h3" class="text-lg font-medium leading-6 text-white">
            Create source
          </DialogTitle>
          <p class="mt-1 text-zinc-400 text-sm">
            Drop will use this source to access your game library, and make them
            available.
          </p>
        </div>
        <form
          class="mt-2 space-y-4"
          @submit.prevent="() => performActionSource_wrapper()"
        >
          <div>
            <label
              for="name"
              class="block text-sm font-medium leading-6 text-zinc-100"
              >Name</label
            >
            <p class="text-zinc-400 block text-xs font-medium leading-6">
              The name of your source, for reference.
            </p>
            <div class="mt-2">
              <input
                id="name"
                v-model="sourceName"
                name="name"
                type="text"
                autocomplete="name"
                placeholder="My New Source"
                class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          <div v-if="createMode">
            <label class="block text-sm font-medium leading-6 text-zinc-100"
              >Type</label
            >
            <p class="text-zinc-400 block text-xs font-medium leading-6">
              The type of your source. Changes the required options.
            </p>

            <RadioGroup v-model="currentSourceOption" class="mt-2">
              <RadioGroupLabel class="sr-only">Type</RadioGroupLabel>
              <div class="space-y-4">
                <RadioGroupOption
                  v-for="[source, metadata] in optionsMetadataIter"
                  :key="source"
                  v-slot="{ checked }"
                  as="template"
                  :value="source"
                >
                  <div
                    :class="[
                      'relative block cursor-pointer bg-zinc-800 rounded-lg border border-zinc-900 px-2 py-2 shadow-sm focus:outline-none sm:flex sm:justify-between',
                    ]"
                  >
                    <span class="flex items-center gap-x-2">
                      <div>
                        <component
                          :is="metadata.icon"
                          class="size-12 bg-zinc-900 rounded-xl p-3 text-zinc-400"
                        />
                      </div>
                      <span class="flex flex-col text-sm">
                        <RadioGroupLabel
                          as="span"
                          class="font-semibold text-zinc-100"
                          >{{ source }}</RadioGroupLabel
                        >
                        <RadioGroupDescription as="span" class="text-zinc-400">
                          {{ metadata.description }}
                        </RadioGroupDescription>
                      </span>
                    </span>
                    <span
                      :class="[
                        checked ? 'ring-2 ring-blue-600' : '',
                        'pointer-events-none absolute -inset-px rounded-lg',
                      ]"
                      aria-hidden="true"
                    />
                  </div>
                </RadioGroupOption>
              </div>
            </RadioGroup>
          </div>

          <div class="h-[1px] w-full bg-zinc-700 rounded-full" />
          <component
            :is="optionUIs[currentSourceOption]"
            v-model="sourceConfig"
          />

          <input type="submit" class="hidden" />
        </form>

        <div v-if="modalError" class="mt-3 rounded-md bg-red-600/10 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-600">
                {{ modalError }}
              </h3>
            </div>
          </div>
        </div>
      </template>

      <template #buttons="{ close }">
        <LoadingButton
          :loading="modalLoading"
          :disabled="modalLoading"
          class="w-full sm:w-fit"
          @click="() => performActionSource_wrapper()"
        >
          {{ createMode ? "Create" : "Save" }}
        </LoadingButton>
        <button
          ref="cancelButtonRef"
          type="button"
          class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
          @click="
            () => {
              editIndex = undefined;
              close();
            }
          "
        >
          Cancel
        </button>
      </template>
    </ModalTemplate>
  </div>
</template>

<script setup lang="ts">
/**
 * I did something a little cursed for this
 * To avoid making a separate modal for saving, we
 * instead set the index of the source we want to edit
 * and there's a bunch of checks everywhere to switch
 * between 'create' and 'edit'
 */

import { SourceOptionsFilesystem } from "#components";
import {
  DialogTitle,
  RadioGroup,
  RadioGroupDescription,
  RadioGroupLabel,
  RadioGroupOption,
} from "@headlessui/vue";
import { XCircleIcon } from "@heroicons/vue/20/solid";
import { CheckIcon, DocumentIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { FetchError } from "ofetch";
import type { Component } from "vue";
import type { LibraryBackend } from "~/prisma/client";
import type { WorkingLibrarySource } from "~/server/api/v1/admin/library/sources/index.get";

definePageMeta({
  layout: "admin",
});

const sources = ref(
  await $dropFetch<WorkingLibrarySource[]>("/api/v1/admin/library/sources"),
);

const editIndex = ref<undefined | number>(undefined);
const createMode = computed(() => editIndex.value === undefined);

const actionSourceOpen = ref(false);
const currentSourceOption = ref<LibraryBackend>("Filesystem");
const sourceName = ref("");
const sourceConfig = ref<object>({});

const modalError = ref<undefined | string>();
const modalLoading = ref(false);

const optionUIs: { [key in LibraryBackend]: Component } = {
  Filesystem: SourceOptionsFilesystem,
};
const optionsMetadata: {
  [key in LibraryBackend]: {
    description: string;
    icon: Component;
  };
} = {
  Filesystem: {
    description:
      "Imports games from a path on disk. Requires version-based folder structure, and supports archived games.",
    icon: DocumentIcon,
  },
};
const optionsMetadataIter = Object.entries(optionsMetadata);

async function performActionSource() {
  const createMode = editIndex.value === undefined;

  const source = await $dropFetch<WorkingLibrarySource>(
    "/api/v1/admin/library/sources",
    {
      body: {
        id: createMode ? undefined : sources.value[editIndex.value!].id,
        name: sourceName.value,
        backend: createMode ? currentSourceOption.value : undefined,
        options: sourceConfig.value,
      },
      method: createMode ? "POST" : "PATCH",
    },
  );
  if (createMode) {
    sources.value.push(source);
  } else {
    sources.value[editIndex.value!] = source;
  }
}

function performActionSource_wrapper() {
  modalError.value = undefined;
  modalLoading.value = true;
  performActionSource()
    .then(() => {
      actionSourceOpen.value = false;
      sourceConfig.value = {};
      sourceName.value = "";
    })
    .catch((e) => {
      if (e instanceof FetchError) {
        modalError.value = e.statusMessage ?? e.message;
      } else {
        modalError.value = e as string;
      }
    })
    .finally(() => {
      modalLoading.value = false;
    });
}

function edit(index: number) {
  const source = sources.value[index];
  if (!source) return;

  sourceName.value = source.name;
  sourceConfig.value = source.options! as object;

  editIndex.value = index;
  actionSourceOpen.value = true;
}

async function deleteSource(index: number) {
  const source = sources.value[index];
  if (!source) return;

  try {
    await $dropFetch("/api/v1/admin/library/sources", {
      method: "DELETE",
      body: { id: source.id },
    });
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to delete library source",
        // @ts-expect-error attempt to display statusMessage on error
        description: `Drop couldn't add delete this source: ${e?.statusMessage}`,
      },
      (_, c) => c(),
    );
  }

  sources.value.splice(index, 1);
}
</script>
