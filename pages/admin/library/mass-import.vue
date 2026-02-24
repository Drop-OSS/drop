<template>
  <div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1
          class="inline-flex items-center gap-x-2 text-base font-semibold text-white"
        >
          <WrenchScrewdriverIcon class="size-6" /> Mass Import Tool
        </h1>
        <p class="mt-2 text-sm text-zinc-300">
          Quickly import a large amount of versions at once.
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <LoadingButton
          :loading="false"
          :disabled="!hasSelected"
          @click="triggerImport"
        >
          Import &rarr;
        </LoadingButton>
      </div>
    </div>
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div class="group/table relative">
            <table
              class="relative min-w-full table-fixed divide-y divide-white/15"
            >
              <thead>
                <tr>
                  <th scope="col" class="relative px-7 sm:w-12 sm:px-6">
                    <div
                      class="group absolute top-1/2 left-4 -mt-2 grid size-4 grid-cols-1"
                    >
                      <input
                        v-model="globalState"
                        :indeterminate="globalState === 'indeterminate'"
                        type="checkbox"
                        class="col-start-1 row-start-1 appearance-none rounded-sm border border-white/20 bg-zinc-800/50 checked:border-blue-500 checked:bg-blue-500 indeterminate:border-blue-500 indeterminate:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-white/10 disabled:bg-zinc-800 disabled:checked:bg-zinc-800 forced-colors:appearance-auto"
                      />
                      <svg
                        class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-zinc-50/25"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          class="opacity-0 group-has-checked:opacity-100"
                          d="M3 8L6 11L11 3.5"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <path
                          class="opacity-0 group-has-indeterminate:opacity-100"
                          d="M3 7H11"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th
                    scope="col"
                    class="w-full py-3.5 pr-3 text-left text-sm font-semibold text-white whitespace-nowrap"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-white whitespace-nowrap"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-white whitespace-nowrap"
                  >
                    Display Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-white whitespace-nowrap"
                  >
                    Setup Mode
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/10 bg-zinc-900">
                <template v-for="game in massImport" :key="game.id">
                  <tr class="text-sm/6 text-zinc-100 bg-zinc-950">
                    <th scope="colgroup" colspan="5" class="py-2 text-left">
                      <div class="inline-flex gap-x-2 px-4">
                        <img
                          :src="useObject(game.icon)"
                          class="size-6 rounded-sm"
                        />
                        {{ game.name }}
                      </div>
                    </th>
                  </tr>
                  <tr
                    v-for="version in game.versions"
                    :key="version.identifier"
                    class="group has-checked:bg-zinc-800/50"
                  >
                    <td class="relative px-7 sm:w-12 sm:px-6">
                      <div
                        className="hidden group-has-checked:block absolute inset-y-0 left-0 w-0.5 bg-blue-500"
                      />

                      <div
                        class="absolute top-1/2 left-4 -mt-2 grid size-4 grid-cols-1"
                      >
                        <input
                          v-model="version.enabled"
                          type="checkbox"
                          class="col-start-1 row-start-1 appearance-none rounded-sm border border-white/20 bg-zinc-800/50 checked:border-blue-500 checked:bg-blue-500 indeterminate:border-blue-500 indeterminate:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-white/10 disabled:bg-zinc-800 disabled:checked:bg-zinc-800 forced-colors:appearance-auto"
                        />
                        <svg
                          class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-zinc-50/25"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            class="opacity-0 group-has-checked:opacity-100"
                            d="M3 8L6 11L11 3.5"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path
                            class="opacity-0 group-has-indeterminate:opacity-100"
                            d="M3 7H11"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </div>
                    </td>
                    <td
                      class="py-4 pr-3 text-sm font-medium whitespace-nowrap text-white group-has-checked:text-blue-400"
                    >
                      {{ version.name }}
                    </td>
                    <td
                      class="px-3 py-4 text-sm whitespace-nowrap text-zinc-400"
                    >
                      {{ version.type }}
                    </td>
                    <td class="px-3 text-sm whitespace-nowrap text-zinc-400">
                      <input
                        id="display-name"
                        v-model="version.settings.displayName"
                        type="text"
                        class="min-w-48 block w-full rounded-md border-radius-md bg-zinc-900 px-3 py-1.5 text-white outline-2 -outline-offset-1 outline-zinc-800 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6"
                        placeholder="My New Version"
                      />
                    </td>

                    <td class="px-3 text-sm whitespace-nowrap text-zinc-400">
                      <Switch
                        v-model="version.settings.setupMode"
                        :class="[
                          version.settings.setupMode
                            ? 'bg-blue-600'
                            : 'bg-zinc-900',
                          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                        ]"
                      >
                        <span
                          aria-hidden="true"
                          :class="[
                            version.settings.setupMode
                              ? 'translate-x-5'
                              : 'translate-x-0',
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          ]"
                        />
                      </Switch>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <TransitionRoot as="template" :show="open">
      <Dialog class="relative z-10" @close="open = false">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to=""
          leave="ease-in duration-200"
          leave-from=""
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-zinc-900/70 transition-opacity"></div>
        </TransitionChild>

        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div
            class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
          >
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enter-to=" translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leave-from=" translate-y-0 sm:scale-100"
              leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel
                class="relative transform overflow-hidden rounded-lg bg-zinc-900 px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-white/10 transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6"
              >
                <div>
                  <div
                    class="mx-auto flex size-12 items-center justify-center rounded-full bg-yellow-500/10"
                  >
                    <ExclamationTriangleIcon
                      class="size-6 text-yellow-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <DialogTitle
                      as="h3"
                      class="text-base font-semibold text-white"
                      >This tool is basic.</DialogTitle
                    >
                    <div class="mt-2">
                      <p class="text-sm text-zinc-400">
                        While it is useful to import a lot of versions at once,
                        this tool is designed for migrating from other projects,
                        rather than building your Drop library from scratch.

                        <span class="text-sm text-zinc-100 font-bold">
                          It is missing functionality present in the normal
                          import wizard.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div class="mt-5 sm:mt-6">
                  <button
                    type="button"
                    class="inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800"
                    @click="open = false"
                  >
                    Accept
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup lang="ts">
import {
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";

import {
  Switch,
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";

definePageMeta({
  layout: "admin",
});

const open = ref(true);

const raw = await $dropFetch("/api/v1/admin/import/massversion");

const massImport = ref(
  raw.map((game) => ({
    ...game,
    versions: game.versions!.map((version) => ({
      ...version,
      enabled: true,
      settings: {
        displayName: undefined,
        setupMode: false,
      },
    })),
  })),
);

const hasSelected = computed(
  () =>
    massImport.value
      .map((v) => v.versions)
      .flat()
      .filter((e) => e.enabled).length > 0,
);

const globalState = computed({
  get() {
    let lastSeen = undefined;
    for (const game of massImport.value) {
      for (const version of game.versions!) {
        if (lastSeen === undefined) {
          lastSeen = version.enabled;
          continue;
        }
        if (lastSeen != version.enabled) return "indeterminate" as const;
      }
    }
    return lastSeen;
  },
  set(v) {
    if (typeof v !== "boolean") return;
    for (const game of massImport.value) {
      for (const version of game.versions!) {
        version.enabled = v;
      }
    }
  },
});

const router = useRouter();
async function triggerImport() {
  const { taskId } = await $dropFetch("/api/v1/admin/import/massversion", {
    method: "POST",
    body: {
      versions: massImport.value
        .map((game) =>
          game.versions
            .filter((version) => version.enabled)
            .map((version) => ({
              id: game.id,
              version: {
                type: version.type,
                identifier: version.identifier,
                name: version.name,
              },
              ...version.settings,
            })),
        )
        .flat(),
    },
  });
  router.push(`/admin/task/${taskId}`);
}
</script>
