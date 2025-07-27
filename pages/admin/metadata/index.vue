<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-16">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">
          {{ $t("library.admin.metadata.tags.title") }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ $t("library.admin.metadata.tags.description") }}
        </p>
      </div>
      <div class="mt-4 lg:ml-16 sm:mt-0 sm:flex-none">
        <NuxtLink
          to="/admin/metadata/tags"
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <i18n-t
            keypath="library.admin.metadata.tags.action"
            tag="span"
            scope="global"
          >
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
      </div>
    </div>
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">
          {{ $t("library.admin.metadata.companies.title") }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ $t("library.admin.metadata.companies.description") }}
        </p>
      </div>
      <div class="mt-4 lg:ml-16 sm:mt-0 sm:flex-none">
        <NuxtLink
          to="/admin/metadata/companies"
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <i18n-t
            keypath="library.admin.metadata.companies.action"
            tag="span"
            scope="global"
          >
            <template #arrow>
              <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
            </template>
          </i18n-t>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "admin",
});
</script>
