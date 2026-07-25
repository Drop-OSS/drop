<template>
  <div class="border-b border-zinc-700 py-5">
    <h3 class="text-base font-semibold font-display leading-6 text-zinc-100">
      Proton Compatibility Layer
    </h3>
  </div>

  <div
    v-if="appState!.umuState === 'Installed'"
    class="rounded-md bg-green-500/10 p-4 outline outline-green-500/20"
  >
    <div class="flex">
      <div class="shrink-0">
        <CheckCircleIcon class="size-5 text-green-400" aria-hidden="true" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-green-200">UMU Launcher installed</h3>
        <div class="mt-2 text-sm text-green-200/85">
          <p>
            The necessary component to use the Proton Compatibility Layer is installed, and
            detected.
          </p>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="rounded-md bg-red-500/15 p-4 outline outline-red-500/25">
    <div class="flex">
      <div class="shrink-0">
        <XCircleIcon class="size-5 text-red-400" aria-hidden="true" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-200">UMU Launcher not installed</h3>
        <div class="mt-2 text-sm text-red-200/80">
          <p>
            You will be unable to install or run games designed for Windows until you install UMU
            Launcher and restart Drop.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="!paths.data.value?.default"
    class="mt-4 rounded-md bg-red-500/15 p-4 outline outline-red-500/25"
  >
    <div class="flex">
      <div class="shrink-0">
        <XCircleIcon class="size-5 text-red-400" aria-hidden="true" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-200">No default Proton layer</h3>
        <div class="mt-2 text-sm text-red-200/80">
          <p>
            You won't be able to launch any Windows games without overriding their Proton layer in
            game settings. Please select a default layer below using the stars.
          </p>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="paths.data.value"
    class="mt-4 text-zinc-100 gap-x-2 inline-flex p-4 w-full items-center justify-center font-bold"
  >
    <DefaultProtonButton v-model="paths.data.value.default" />
    = Default Proton Layer
  </div>

  <!-- autodiscovered table -->
  <div class="mt-2">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-white">Auto-discovered Proton Layers</h1>
        <p class="mt-2 text-sm text-gray-300">
          All auto-discovered Proton Layers from common paths on your system.
        </p>
      </div>
    </div>
    <div class="mt-2 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table class="relative min-w-full divide-y divide-white/15">
            <thead>
              <tr>
                <th
                  scope="col"
                  class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-white sm:pl-0"
                >
                  Name
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-white">
                  Path
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/10">
              <tr v-for="path in paths.data.value?.autodiscovered" :key="path.path">
                <td
                  class="py-4 pr-3 pl-4 text-sm font-medium inline-flex items-center gap-x-2 whitespace-nowrap text-white sm:pl-0"
                >
                  <DefaultProtonButton :path="path.path" v-model="paths.data.value!.default" />
                  {{ path.name }}
                </td>
                <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-400">
                  {{ path.path }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- custom table -->
  <div class="mt-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-white">Manual Proton Layers</h1>
        <p class="mt-2 text-sm text-gray-300">
          Add or remove custom Proton compatible layers for your games. We recommend
          <a
            href="https://github.com/DavidoTek/ProtonUp-Qt"
            target="_blank"
            class="text-blue-400 hover:text-blue-500"
            >ProtonUp-Qt</a
          >
          to download and manage your proton layers.
        </p>
        <p class="mt-2 text-sm text-gray-300">
          Note: deleting a custom Proton layer will
          <span class="font-bold">not</span> clear it from manually selected Proton layers.
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          @click="pickLayerModal = true"
          type="button"
          class="block rounded-md bg-blue-500 px-3 py-2 text-center text-sm font-semibold text-white shadow-xs hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Add layer
        </button>
      </div>
    </div>
    <div class="mt-2 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table class="relative min-w-full divide-y divide-white/15">
            <thead>
              <tr>
                <th
                  scope="col"
                  class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-white sm:pl-0"
                >
                  Name
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-white">
                  Path
                </th>
                <th scope="col" class="py-3.5 pr-4 pl-3 sm:pr-0">
                  <span class="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/10">
              <tr v-for="(path, pathIdx) in paths.data.value?.custom" :key="path.path">
                <td
                  class="py-4 pr-3 pl-4 text-sm font-medium inline-flex items-center gap-x-2 whitespace-nowrap text-white sm:pl-0"
                >
                  <DefaultProtonButton :path="path.path" v-model="paths.data.value!.default" />
                  {{ path.name }}
                </td>
                <td class="px-3 py-4 text-sm whitespace-nowrap text-gray-400">
                  {{ path.path }}
                </td>
                <td class="py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-0">
                  <button
                    type="button"
                    @click="() => deleteCustom(pathIdx)"
                    class="text-red-400 hover:text-red-300"
                  >
                    Delete<span class="sr-only"></span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <ModalTemplate v-model="pickLayerModal">
    <template #default>
      <div class="sm:flex sm:items-start">
        <div class="mt-3 text-center sm:mt-0 sm:text-left">
          <h3 class="text-base font-semibold text-zinc-100">Select your Proton layer</h3>
          <div class="mt-2">
            <p class="text-sm text-zinc-400">
              Select the path to your Proton layer. It should have at least two files, one named
              "proton" and one named "compatibilitytool.vdf", for Drop to recognise it.
            </p>
          </div>
        </div>
      </div>

      <div class="p-3 bg-zinc-950 ring-2 ring-zinc-800 rounded-lg text-sm">
        <span v-if="path" class="text-zinc-100">{{ path }}</span>
        <span v-else class="italic text-zinc-400">No path selected.</span>
      </div>

      <LoadingButton :loading="false" @click="pickLayer">Select path</LoadingButton>

      <div v-if="pickError" class="rounded-md bg-red-500/15 p-4 outline outline-red-500/25">
        <div class="flex">
          <div class="shrink-0">
            <XCircleIcon class="size-5 text-red-400" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-200">
              {{ pickError }}
            </h3>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        @click="() => add()"
        :loading="false"
        :disabled="!path"
        type="submit"
        class="ml-2 w-full sm:w-fit"
      >
        Add
      </LoadingButton>
      <button
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="cancel"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { CheckCircleIcon, XCircleIcon } from "@heroicons/vue/16/solid";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const appState = useAppState();

const paths = await useProtonPaths();
const pickLayerModal = ref(false);
const pickError = ref<string | null>(null);

const path = ref<string | null>(null);

async function pickLayer() {
  const file = await open({
    multiple: false,
    directory: true,
    canCreateDirectories: true,
  });
  path.value = file;
  pickError.value = null;
}

async function add() {
  if (!path.value) return;
  pickError.value = null;
  try {
    await invoke("add_proton_layer", { path: path.value });
    path.value = null;
    pickLayerModal.value = false;
    paths.refresh();
  } catch (e) {
    pickError.value = (e as string).toString();
  }
}

function cancel() {
  pickLayerModal.value = false;
  path.value = null;
}

async function deleteCustom(index: number) {
  if (!paths.data.value) return;
  await invoke("remove_proton_layer", { index });
  const deleted = paths.data.value.custom.splice(index);
  if (paths.data.value.default == deleted[0].path) {
    paths.data.value.default = undefined;
  }
}
</script>
