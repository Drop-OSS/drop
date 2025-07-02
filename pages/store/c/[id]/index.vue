<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="w-full overflow-x-hidden">
    <div
      class="relative w-full p-24 flex items-center justify-center bg-zinc-950 overflow-hidden"
    >
      <div
        class="inline-flex items-center gap-x-4 z-10 bg-zinc-950 p-5 rounded-lg"
      >
        <img
          :src="useObject(company.mLogoObjectId)"
          class="size-24 rounded-sm"
        />
        <div>
          <h1 class="text-4xl text-zinc-100 font-semibold">
            {{ company.mName }}
          </h1>
          <p class="mt-2 text-sm text-zinc-400 max-w-sm">
            {{ company.mShortDescription }}
          </p>
        </div>
      </div>
      <img
        :src="useObject(company.mBannerObjectId)"
        class="absolute inset-0 w-full z-0 object-cover object-center blur-sm"
      />
    </div>
    <div class="px-4 sm:px-12 py-4 sm:py-10">
      <h1 class="text-xl text-zinc-200 font-semibold">About</h1>
      <div
        class="mt-4 mb-4 prose prose-invert prose-blue max-w-none"
        v-html="description"
      />
      <NuxtLink
        :href="company.mWebsite"
        :external="true"
        target="_blank"
        class="rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-white/20"
        >Website</NuxtLink
      >
    </div>
    <div class="space-y-4">
      <div class="px-4 sm:px-12 py-4">
        <h1 class="text-zinc-100 text-2xl font-bold font-display">Developed</h1>
        <NuxtLink class="text-blue-600 font-semibold">
          <i18n-t keypath="store.exploreMore" tag="span" scope="global">
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
        <div class="mt-4">
          <GameCarousel :items="company.developed" :min="12" />
        </div>
      </div>
      <div class="px-4 sm:px-12 py-4">
        <h1 class="text-zinc-100 text-2xl font-bold font-display">Published</h1>
        <NuxtLink class="text-blue-600 font-semibold">
          <i18n-t keypath="store.exploreMore" tag="span" scope="global">
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
        <div class="mt-4">
          <GameCarousel :items="company.published" :min="12" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { micromark } from "micromark";

const route = useRoute();
const companyId = route.params.id;

const { company } = await $dropFetch(`/api/v1/companies/${companyId}`);

const description = micromark(company.mDescription);

useHead({
  title: company.mName,
  link: [{ rel: "icon", href: useObject(company.mLogoObjectId) }],
});
</script>
