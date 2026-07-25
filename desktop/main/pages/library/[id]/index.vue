<template>
  <div class="mx-auto w-full relative flex flex-col justify-center pt-72 overflow-hidden">
    <div class="absolute inset-0 z-0">
      <img :src="bannerUrl" alt="" class="w-full h-[24rem] object-cover blur-sm scale-105" />
      <div
        class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-transparent opacity-90"
      />
      <div
        class="absolute inset-0 bg-gradient-to-r from-zinc-900/95 via-zinc-900/80 to-transparent opacity-90"
      />
    </div>

    <div class="relative z-10">
      <div class="px-8">
        <h1 class="text-5xl text-zinc-100 font-bold font-display drop-shadow-lg">
          {{ game.mName }}
        </h1>
        <div
          class="relative"
          v-if="
            status.type === 'Installed' &&
            status.install_type.type != InstalledType.PartiallyInstalled
          "
        >
          <div
            v-if="!version?.userConfiguration?.enableUpdates"
            class="absolute mt-1 inline-flex items-center gap-x-1 text-xs text-zinc-400"
          >
            Version pinned
            <svg
              class="size-3 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19.1835 7.80516L16.2188 4.83755C14.1921 2.8089 13.1788 1.79457 12.0904 2.03468C11.0021 2.2748 10.5086 3.62155 9.5217 6.31506L8.85373 8.1381C8.59063 8.85617 8.45908 9.2152 8.22239 9.49292C8.11619 9.61754 7.99536 9.72887 7.86251 9.82451C7.56644 10.0377 7.19811 10.1392 6.46145 10.3423C4.80107 10.8 3.97088 11.0289 3.65804 11.5721C3.5228 11.8069 3.45242 12.0735 3.45413 12.3446C3.45809 12.9715 4.06698 13.581 5.28476 14.8L6.69935 16.2163L2.22345 20.6964C1.92552 20.9946 1.92552 21.4782 2.22345 21.7764C2.52138 22.0746 3.00443 22.0746 3.30236 21.7764L7.77841 17.2961L9.24441 18.7635C10.4699 19.9902 11.0827 20.6036 11.7134 20.6045C11.9792 20.6049 12.2404 20.5358 12.4713 20.4041C13.0192 20.0914 13.2493 19.2551 13.7095 17.5825C13.9119 16.8472 14.013 16.4795 14.2254 16.1835C14.3184 16.054 14.4262 15.9358 14.5468 15.8314C14.8221 15.593 15.1788 15.459 15.8922 15.191L17.7362 14.4981C20.4 13.4973 21.7319 12.9969 21.9667 11.9115C22.2014 10.826 21.1954 9.81905 19.1835 7.80516Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div
            v-else-if="!status.update_available"
            class="absolute mt-1 inline-flex items-center gap-x-1 text-xs text-zinc-400"
          >
            Up to date <CheckCircleIcon class="size-3 text-green-600" />
          </div>
          <div
            v-else-if="status.update_available"
            class="absolute mt-1 inline-flex items-center gap-x-1 text-xs text-zinc-400"
          >
            Update available <ArrowDownTrayIcon class="size-3 text-blue-600" />
          </div>
        </div>

        <div class="mt-8 flex flex-row gap-x-4 items-stretch">
          <!-- Do not add scale animations to this: https://stackoverflow.com/a/35683068 -->
          <GameStatusButton
            @install="() => installFlow()"
            @launch="() => launch()"
            @queue="() => queue()"
            @uninstall="() => uninstall()"
            @kill="() => kill()"
            @options="() => (configureModalOpen = true)"
            @resume="() => resumeDownload()"
            :status="status"
          />
          <button
            type="button"
            v-if="status.type === 'Installed' && status.update_available"
            class="transition-transform duration-300 hover:scale-105 active:scale-95 inline-flex gap-x-2 items-center rounded-md bg-blue-600 px-6 font-semibold text-white shadow-xl backdrop-blur-sm hover:bg-blue-700 uppercase font-display"
            @click="() => installFlow()"
          >
            Update <ArrowDownTrayIcon class="size-5" />
          </button>
          <NuxtLink
            class="transition-transform duration-300 hover:scale-105 active:scale-95 inline-flex items-center rounded-md bg-zinc-800/50 px-6 font-semibold text-white shadow-xl backdrop-blur-sm hover:bg-zinc-800/80 uppercase font-display"
            :to="{
              path: '/store',
              query: {
                gameId: game.id,
              },
            }"
          >
            <BuildingStorefrontIcon class="mr-2 size-5" aria-hidden="true" />
            Store
          </NuxtLink>
        </div>
      </div>

      <!-- Main content -->
      <div class="mt-8 w-full bg-zinc-900 px-8">
        <div class="grid grid-cols-[2fr,1fr] gap-8">
          <div class="space-y-6">
            <div class="bg-zinc-800/50 rounded-xl p-6 backdrop-blur-sm">
              <div
                v-html="htmlDescription"
                class="prose prose-invert prose-blue overflow-y-auto custom-scrollbar max-w-none"
              ></div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="bg-zinc-800/50 rounded-xl p-6 backdrop-blur-sm">
              <h2 class="text-xl font-display font-semibold text-zinc-100 mb-4">Game Images</h2>
              <div class="relative">
                <div v-if="game.mImageCarouselObjectIds.length > 0">
                  <div
                    class="relative aspect-video rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <div
                      class="absolute inset-0"
                      @click="fullscreenImage = game.mImageCarouselObjectIds[currentImageIndex]"
                    >
                      <TransitionGroup name="slide" tag="div" class="h-full">
                        <img
                          v-for="(url, index) in game.mImageCarouselObjectIds"
                          :key="index"
                          :src="useObject(url)"
                          class="absolute inset-0 w-full h-full object-cover"
                          v-show="index === currentImageIndex"
                          alt=""
                        />
                      </TransitionGroup>
                    </div>

                    <div
                      class="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    >
                      <div class="pointer-events-auto">
                        <button
                          type="button"
                          v-if="game.mImageCarouselObjectIds.length > 1"
                          @click.stop="previousImage()"
                          class="p-2 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900/80 transition-all duration-300 hover:scale-110"
                        >
                          <ChevronLeftIcon class="size-5" />
                        </button>
                      </div>
                      <div class="pointer-events-auto">
                        <button
                          type="button"
                          v-if="game.mImageCarouselObjectIds.length > 1"
                          @click.stop="nextImage()"
                          class="p-2 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900/80 transition-all duration-300 hover:scale-110"
                        >
                          <ChevronRightIcon class="size-5" />
                        </button>
                      </div>
                    </div>

                    <div
                      class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    />
                    <div
                      class="absolute bottom-4 right-4 flex items-center gap-x-2 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    >
                      <ArrowsPointingOutIcon class="size-5" />
                      <span class="text-sm font-medium">View Fullscreen</span>
                    </div>
                  </div>

                  <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-x-2">
                    <button
                      type="button"
                      v-for="(_, index) in game.mImageCarouselObjectIds"
                      :key="index"
                      @click.stop="currentImageIndex = index"
                      class="w-1.5 h-1.5 rounded-full transition-all"
                      :class="[
                        currentImageIndex === index
                          ? 'bg-zinc-100 scale-125'
                          : 'bg-zinc-600 hover:bg-zinc-500',
                      ]"
                    />
                  </div>
                </div>

                <div
                  v-else
                  class="aspect-video rounded-lg overflow-hidden bg-zinc-900/50 flex flex-col items-center justify-center text-center px-4"
                >
                  <PhotoIcon class="size-12 text-zinc-500 mb-2" />
                  <p class="text-zinc-400 font-medium">No images available</p>
                  <p class="text-zinc-500 text-sm">
                    Game screenshots will appear here when available
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ModalTemplate v-model="installFlowOpen">
    <template #default>
      <div class="sm:flex sm:items-start">
        <div class="mt-3 text-center sm:mt-0 sm:text-left">
          <h3 class="text-base font-semibold text-zinc-100">Install {{ game.mName }}?</h3>
          <div class="mt-2">
            <p class="text-sm text-zinc-400">
              Drop will add {{ game.mName }} to the queue to be downloaded. While downloading, Drop
              may use up a large amount of resources, particularly network bandwidth and CPU
              utilisation.
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div v-if="versionOptions && versionOptions.length > 0">
          <Listbox as="div" v-model="installVersionIndex">
            <ListboxLabel class="block text-sm/6 font-medium text-zinc-100">Version</ListboxLabel>
            <div class="relative mt-2">
              <ListboxButton
                class="relative w-full cursor-default rounded-md bg-zinc-800 py-1.5 pl-3 pr-10 text-left text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:text-sm/6"
              >
                <span class="block truncate">{{
                  formatVersionOptionText(installVersionIndex)
                }}</span>
                <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                </span>
              </ListboxButton>

              <div
                v-if="installVersionIndex == -1"
                class="mt-3 rounded-md bg-blue-500/10 p-2 outline outline-blue-500/20"
              >
                <div class="flex">
                  <div class="shrink-0">
                    <InformationCircleIcon class="size-4 text-blue-400" aria-hidden="true" />
                  </div>
                  <div class="ml-2 flex-1 md:flex md:justify-between">
                    <p class="text-xs text-blue-300">
                      "Latest" will notify you when there is a new version available. Choose another
                      version to pin this game's version.
                    </p>
                  </div>
                </div>
              </div>
              <div v-else class="mt-3 rounded-md bg-blue-500/10 p-2 outline outline-blue-500/20">
                <div class="flex">
                  <div class="shrink-0">
                    <InformationCircleIcon class="size-4 text-blue-400" aria-hidden="true" />
                  </div>
                  <div class="ml-2 flex-1 md:flex md:justify-between">
                    <p class="text-xs text-blue-300">
                      This game will be pinned to "{{
                        currentVersionOption?.displayName || currentVersionOption?.versionPath
                      }}"
                    </p>
                  </div>
                </div>
              </div>

              <transition
                leave-active-class="transition ease-in duration-100"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <ListboxOptions
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  <ListboxOption as="template" :value="-1" v-slot="{ active, selected }">
                    <li
                      :class="[
                        active ? 'bg-blue-600 text-white' : 'text-zinc-300',
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                      ]"
                    >
                      <span
                        :class="[
                          selected ? 'font-semibold text-zinc-100' : 'font-normal',
                          'block truncate',
                        ]"
                        >{{ formatVersionOptionText(-1) }}</span
                      >

                      <span
                        v-if="selected"
                        :class="[
                          active ? 'text-white' : 'text-blue-600',
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                        ]"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>

                  <ListboxOption
                    as="template"
                    v-for="(version, versionIdx) in versionOptions"
                    :key="version.versionId"
                    :value="versionIdx"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        active ? 'bg-blue-600 text-white' : 'text-zinc-300',
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                      ]"
                    >
                      <span
                        :class="[
                          selected ? 'font-semibold text-zinc-100' : 'font-normal',
                          'block truncate',
                        ]"
                        >{{ formatVersionOptionText(versionIdx) }}</span
                      >

                      <span
                        v-if="selected"
                        :class="[
                          active ? 'text-white' : 'text-blue-600',
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                        ]"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </transition>
            </div>
          </Listbox>
        </div>
        <div
          v-else-if="versionOptions === null || versionOptions?.length == 0"
          class="mt-1 rounded-md bg-red-600/10 p-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-600">
                There are no supported versions to install. Please contact your server admin or try
                again later.
              </h3>
            </div>
          </div>
        </div>
        <div v-else class="w-full flex items-center justify-center p-4">
          <div role="status" aria-live="polite">
            <svg
              aria-hidden="true"
              class="w-7 h-7 text-transparent animate-spin fill-white"
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
        </div>
        <div v-if="installDirs">
          <InstallDirectorySelector :install-dirs="installDirs" v-model="installDir" />
        </div>
        <div
          v-if="
            currentVersionOption?.requiredContent && currentVersionOption.requiredContent.length > 0
          "
        >
          <div class="border-b border-white/10 py-2">
            <h3 class="text-sm font-semibold text-white">Install additional dependencies?</h3>
            <p class="mt-1 text-xs text-gray-400">
              This game requires additional content to run. Click the components to automatically
              queue for download.
            </p>
          </div>
          <ul class="mt-2 divide-y divide-white/5">
            <li
              v-for="content in currentVersionOption.requiredContent"
              :key="content.versionId"
              :class="[
                !installDepsDisabled[content.versionId] ? 'bg-zinc-950 ring-2 ring-zinc-800' : '',
                'rounded-lg relative flex justify-between px-2 py-3',
              ]"
            >
              <div class="flex min-w-0 gap-x-2">
                <img class="size-12 flex-none" :src="useObject(content.iconObjectId)" alt="" />
                <div class="min-w-0 flex-auto">
                  <p class="text-sm/6 font-semibold text-white">
                    <button
                      type="button"
                      @click="
                        () =>
                          (installDepsDisabled[content.versionId] =
                            !installDepsDisabled[content.versionId])
                      "
                    >
                      <span class="absolute inset-x-0 -top-px bottom-0"></span>
                      {{ content.name }}
                    </button>
                  </p>
                  <p class="mt-1 flex text-xs/5 text-gray-400">
                    {{ content.shortDescription }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-x-2">
                <div class="hidden sm:flex sm:flex-col sm:items-end">
                  <p class="inline-flex items-center gap-x-1 text-xs/5 text-gray-400">
                    {{ formatKilobytes(content.size.installSize / 1024) }}B
                    <ServerIcon class="size-3" />
                  </p>
                </div>
                <CheckIcon
                  v-if="!installDepsDisabled[content.versionId]"
                  class="size-5 flex-none text-green-500"
                  aria-hidden="true"
                />
                <MinusIcon v-else class="size-5 flex-none text-gray-500" aria-hidden="true" />
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="installError" class="mt-1 rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ installError }}
            </h3>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        @click="() => install()"
        :disabled="!(versionOptions && versionOptions.length > 0)"
        :loading="installLoading"
        type="submit"
        class="ml-2 w-full sm:w-fit"
      >
        Install
      </LoadingButton>
      <button
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="installFlowOpen = false"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>

  <ModalTemplate :model-value="launchOptionsOpen">
    <template #default>
      <div class="sm:flex sm:items-start">
        <div class="mt-3 text-center sm:mt-0 sm:text-left">
          <h3 class="text-base font-semibold text-zinc-100">Launch {{ game.mName }}</h3>
          <div class="mt-2">
            <p class="text-sm text-zinc-400">
              The instance admin has configured multiple ways to start this game. Select an option
              to start.
            </p>
          </div>
        </div>
      </div>

      <ol class="space-y-2">
        <li v-for="(launchData, launchIdx) in launchOptions!">
          <button
            type="button"
            class="transition w-full rounded-sm bg-zinc-800 inline-flex items-center text-sm py-2 px-3 gap-x-2 text-zinc-100 hover:text-zinc-300 hover:bg-zinc-700"
            @click="() => launchIndex(launchIdx)"
          >
            <PlayIcon class="size-4" />
            <span>
              {{ launchData.name }}
            </span>
          </button>
        </li>
      </ol>
    </template>
    <template #buttons>
      <button
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="launchOptions = undefined"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>

  <!-- 
  Dear future DecDuck,
  This v-if is necessary for Vue rendering reasons
  (it tries to access the game version for not installed games)
  You have already tried to remove it
  Don't.  
  -->
  <GameOptionsModal
    v-if="
      status.type === 'Installed' &&
      (status.install_type.type == InstalledType.Installed ||
        status.install_type.type == InstalledType.SetupRequired)
    "
    v-model="configureModalOpen"
    :game-id="game.id"
  />

  <Transition
    enter="transition ease-out duration-300"
    enter-from="opacity-0"
    enter-to="opacity-100"
    leave="transition ease-in duration-200"
    leave-from="opacity-100"
    leave-to="opacity-0"
  >
    <div
      v-if="fullscreenImage"
      class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      @click="fullscreenImage = null"
    >
      <div class="relative w-full h-full flex items-center justify-center" @click.stop>
        <button
          type="button"
          aria-label="Close fullscreen"
          class="absolute top-4 right-4 p-2 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900 transition-colors"
          @click.stop="fullscreenImage = null"
        >
          <XMarkIcon class="size-6" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Previous image"
          v-if="game.mImageCarouselObjectIds.length > 1"
          @click.stop="previousImage()"
          class="absolute left-4 p-3 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900 transition-colors"
        >
          <ChevronLeftIcon class="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next image"
          v-if="game.mImageCarouselObjectIds.length > 1"
          @click.stop="nextImage()"
          class="absolute right-4 p-3 rounded-full bg-zinc-900/50 text-zinc-100 hover:bg-zinc-900 transition-colors"
        >
          <ChevronRightIcon class="size-6" aria-hidden="true" />
        </button>

        <TransitionGroup
          name="slide"
          tag="div"
          class="w-full h-full flex items-center justify-center"
          @click.stop
        >
          <img
            v-for="(url, index) in game.mImageCarouselObjectIds"
            v-show="currentImageIndex === index"
            :key="index"
            :src="useObject(url)"
            class="max-h-[90vh] max-w-[90vw] object-contain"
            :alt="`${game.mName} screenshot ${index + 1}`"
          />
        </TransitionGroup>

        <div
          class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-zinc-900/50 backdrop-blur-sm"
        >
          <p class="text-zinc-100 text-sm font-medium">
            {{ currentImageIndex + 1 }} /
            {{ game.mImageCarouselObjectIds.length }}
          </p>
        </div>
      </div>
    </div>
  </Transition>

  <DependencyRequiredModal v-if="dependencyRequiredModal" v-model="dependencyRequiredModal" />
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import {
  CheckIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowsPointingOutIcon,
  PhotoIcon,
  PlayIcon,
  InformationCircleIcon,
} from "@heroicons/vue/20/solid";
import { BuildingStorefrontIcon } from "@heroicons/vue/24/outline";
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  MinusIcon,
  ServerIcon,
  XCircleIcon,
} from "@heroicons/vue/24/solid";
import { invoke } from "@tauri-apps/api/core";
import { micromark } from "micromark";
import { InstalledType } from "~/types";

const route = useRoute();
const router = useRouter();
const id = route.params.id.toString();

const { game, status, version } = await useGame(id);

const bannerUrl = await useObject(game.mBannerObjectId);

const htmlDescription = micromark(game.mDescription);

const installFlowOpen = ref(false);
const versionOptions = ref<undefined | Array<VersionOption>>();
const installDirs = ref<undefined | Array<string>>();
const currentImageIndex = ref(0);

const configureModalOpen = ref(false);

async function installFlow() {
  installFlowOpen.value = true;
  versionOptions.value = undefined;
  installDirs.value = undefined;
  installError.value = undefined;

  try {
    versionOptions.value = await invoke("fetch_game_version_options", {
      gameId: game.id,
    });
    installDirs.value = await invoke("fetch_download_dir_stats");
  } catch (error) {
    installError.value = (error as string).toString();
    versionOptions.value = undefined;
  }
}

const installLoading = ref(false);
const installError = ref<string | undefined>();
const installVersionIndex = ref(-1);
const installDir = ref(0);
const installDepsDisabled = ref<{ [key: string]: boolean }>({});

async function install() {
  try {
    if (!versionOptions.value) throw new Error("Versions have not been loaded");
    installLoading.value = true;
    const versionOption = versionOptions.value[Math.max(installVersionIndex.value, 0)];
    const isLatest = installVersionIndex.value == -1;

    const games = [
      { gameId: game.id, versionId: versionOption.versionId },
      ...versionOption.requiredContent
        .filter((v) => !installDepsDisabled.value[v.versionId])
        .map((v) => ({ gameId: v.gameId, versionId: v.versionId })),
    ];

    for (const game of games) {
      await invoke("download_game", {
        gameId: game.gameId,
        versionId: game.versionId,
        installDir: installDir.value,
        targetPlatform: versionOption.platform,
        enableUpdates: isLatest,
      });
    }

    installFlowOpen.value = false;
  } catch (error) {
    installError.value = (error as string).toString();
  }

  installLoading.value = false;
}

const currentVersionOption = computed(
  () => versionOptions.value?.[Math.max(installVersionIndex.value, 0)],
);

function formatVersionOptionText(index: number) {
  if (!versionOptions.value) return undefined;
  const versionOption = versionOptions.value[Math.max(index, 0)];
  const template = `${versionOption.displayName || versionOption.versionPath} on ${versionOption.platform}, ${formatKilobytes(versionOption.size.installSize / 1024)}B`;
  if (index == -1) {
    return `Latest (${template})`;
  }
  return template;
}

async function resumeDownload() {
  try {
    await invoke("resume_download", { gameId: game.id });
  } catch (e) {
    console.error(e);
  }
}

const launchOptions = ref<Array<{ name: string }> | undefined>(undefined);
const launchOptionsOpen = computed(() => launchOptions.value !== undefined);

async function launch() {
  if (
    status.value.type == "Installed" &&
    status.value.install_type.type == InstalledType.SetupRequired
  ) {
    await launchIndex(0);
    return;
  }
  try {
    const fetchedLaunchOptions = await invoke<Array<{ name: string }>>("get_launch_options", {
      id: game.id,
    });
    if (fetchedLaunchOptions.length == 1) {
      await launchIndex(0);
      return;
    }
    launchOptions.value = fetchedLaunchOptions;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: `Couldn't run "${game.mName}"`,
        description: `Drop failed to launch "${game.mName}": ${e}`,
        buttonText: "Close",
      },
      (e, c) => c(),
    );
    console.error(e);
  }
}

const dependencyRequiredModal = ref<{ gameId: string; versionId: string } | undefined>(undefined);

async function launchIndex(index: number) {
  launchOptions.value = undefined;
  try {
    const result = await invoke<LaunchResult>("launch_game", {
      id: game.id,
      index,
    });
    if (result.result == "InstallRequired") {
      dependencyRequiredModal.value = {
        gameId: result.data[0],
        versionId: result.data[1],
      };
    }
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: `Couldn't run "${game.mName}"`,
        description: `Drop failed to launch "${game.mName}": ${e}`,
        buttonText: "Close",
      },
      (e, c) => c(),
    );
  }
}

async function queue() {
  router.push("/queue");
}

async function uninstall() {
  await invoke("uninstall_game", { gameId: game.id });
}

async function kill() {
  try {
    await invoke("kill_game", { gameId: game.id });
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: `Couldn't stop "${game.mName}"`,
        description: `Drop failed to stop "${game.mName}": ${e}`,
        buttonText: "Close",
      },
      (e, c) => c(),
    );
    console.error(e);
  }
}

function nextImage() {
  currentImageIndex.value = (currentImageIndex.value + 1) % game.mImageCarouselObjectIds.length;
}

function previousImage() {
  currentImageIndex.value =
    (currentImageIndex.value - 1 + game.mImageCarouselObjectIds.length) %
    game.mImageCarouselObjectIds.length;
}

const fullscreenImage = ref<string | null>(null);
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  position: absolute;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(82 82 91) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgb(82 82 91);
  border-radius: 3px;
}
</style>
