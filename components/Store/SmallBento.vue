<template>
  <div>
    <div class="px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div class="sm:flex sm:items-baseline sm:justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-zinc-100">
          {{ props.title }}
        </h2>
        <NuxtLink
          href="#"
          class="hidden text-sm font-semibold text-blue-600 hover:text-blue-500 sm:block"
        >
          <i18n-t keypath="store.exploreMore" tag="span" scope="global">
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
      </div>

      <div
        class="mt-6 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:grid-rows-2 sm:gap-x-6 lg:gap-8"
      >
        <!-- item 1 -->
        <div
          class="group relative aspect-2/1 overflow-hidden rounded-lg sm:row-span-2 sm:aspect-square"
        >
          <img
            :src="useObject(source[0].mCoverObjectId)"
            class="absolute size-full object-cover group-hover:opacity-75"
          />
          <div
            aria-hidden="true"
            class="transition absolute inset-0 bg-linear-to-b from-transparent to-black opacity-50"
          />
          <div class="absolute inset-0 flex items-end p-6">
            <div>
              <h3 class="font-semibold text-white">
                <a href="#">
                  <span class="absolute inset-0" />
                  {{ source[0].mName }}
                </a>
              </h3>
              <p aria-hidden="true" class="mt-1 text-sm text-white">
                {{ source[0].mShortDescription }}
              </p>
            </div>
          </div>
        </div>
        <!-- item 2 -->
        <div
          class="group relative aspect-2/1 overflow-hidden rounded-lg sm:aspect-auto"
        >
          <img
            :src="useObject(source[1].mCoverObjectId)"
            class="absolute size-full object-cover group-hover:opacity-75"
          />
          <div
            aria-hidden="true"
            class="transition absolute inset-0 bg-linear-to-b from-transparent to-black opacity-50"
          />
          <div class="absolute inset-0 flex items-end p-6">
            <div>
              <h3 class="font-semibold text-white">
                <a href="#">
                  <span class="absolute inset-0" />
                  {{ source[1].mName }}
                </a>
              </h3>
              <p aria-hidden="true" class="mt-1 text-sm text-white">
                {{ source[1].mShortDescription }}
              </p>
            </div>
          </div>
        </div>
        <!-- item 3 -->
        <div
          class="group relative aspect-2/1 overflow-hidden rounded-lg sm:aspect-auto"
        >
          <img
            :src="useObject(source[2].mCoverObjectId)"
            class="transition absolute size-full object-cover group-hover:opacity-75"
          />
          <div
            aria-hidden="true"
            class="absolute inset-0 bg-linear-to-b from-transparent to-black opacity-50"
          />
          <div class="absolute inset-0 flex items-end p-6">
            <div>
              <h3 class="font-semibold text-white">
                <a href="#">
                  <span class="absolute inset-0" />
                  {{ source[2].mName }}
                </a>
              </h3>
              <p aria-hidden="true" class="mt-1 text-sm text-white">
                {{ source[2].mShortDescription }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 sm:hidden">
        <i18n-t keypath="store.exploreMore" tag="span" scope="global">
          <template #arrow>
            <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
          </template>
        </i18n-t>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TitleSourceValidatorType } from "~/server/internal/store/types";

const props = defineProps<TitleSourceValidatorType>();

const source = await useStoreSource(props.source, 3);
</script>
