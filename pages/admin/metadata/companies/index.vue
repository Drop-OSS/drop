<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold text-zinc-100">
          {{ $t("library.admin.metadata.companies.title") }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ $t("library.admin.metadata.companies.description") }}
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <NuxtLink
          to="/admin/library/sources"
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <i18n-t
            keypath="library.admin.sources.link"
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
    <div class="mt-2 grid grid-cols-1">
      <input
        id="search"
        v-model="searchQuery"
        type="text"
        name="search"
        class="col-start-1 row-start-1 block w-full rounded-md bg-zinc-900 py-1.5 pl-10 pr-3 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:pl-9 sm:text-sm/6"
        :placeholder="$t('library.admin.metadata.companies.search')"
      />
      <MagnifyingGlassIcon
        class="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-zinc-400 sm:size-4"
        aria-hidden="true"
      />
    </div>
    <ul
      role="list"
      class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    >
      <li
        v-for="company in filteredCompanies"
        :key="company.id"
        class="relative overflow-hidden col-span-1 flex flex-col justify-center divide-y divide-zinc-800 rounded-xl bg-zinc-950/30 text-left shadow-md border hover:scale-102 hover:shadow-xl hover:bg-zinc-950/70 border-zinc-800 transition-all duration-200 group"
      >
        <div class="flex flex-1 flex-row p-4 gap-x-4">
          <img
            class="h-20 w-20 p-3 flex-shrink-0 rounded-xl shadow group-hover:shadow-lg transition-all duration-200 bg-zinc-900 object-cover border border-zinc-800"
            :src="useObject(company.mLogoObjectId)"
            alt=""
          />
          <div class="flex flex-col">
            <h3
              class="gap-x-2 text-sm inline-flex items-center font-medium text-zinc-100 font-display"
            >
              {{ company.mName }}
            </h3>
            <dl class="mt-1 flex flex-col justify-between">
              <dt class="sr-only">{{ $t("library.admin.shortDesc") }}</dt>
              <dd class="text-sm text-zinc-400">
                {{ company.mShortDescription }}
              </dd>
            </dl>
            <div class="mt-4 flex flex-col gap-y-1">
              <NuxtLink
                :href="`/admin/metadata/companies/${company.id}`"
                class="w-fit rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <i18n-t
                  keypath="library.admin.openEditor"
                  tag="span"
                  scope="global"
                >
                  <template #arrow>
                    <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                  </template>
                </i18n-t>
              </NuxtLink>
              <button
                class="w-fit rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-500 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                @click="() => deleteCompany(company.id)"
              >
                {{ $t("delete") }}
              </button>
            </div>
          </div>
        </div>
      </li>
      <p
        v-if="filteredCompanies.length == 0 && companies.length != 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("common.noResults") }}
      </p>
      <p
        v-if="filteredCompanies.length == 0 && companies.length == 0"
        class="text-zinc-600 text-sm font-display font-bold uppercase text-center col-span-4"
      >
        {{ $t("library.admin.metadata.companies.noCompanies") }}
      </p>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";
import type { CompanyModel } from "~/prisma/client/models";

const { t } = useI18n();

definePageMeta({
  layout: "admin",
});

useHead({
  title: t("library.admin.metadata.companies.title"),
});

const searchQuery = ref("");

const companies = ref(await $dropFetch("/api/v1/admin/company"));

const filteredCompanies = computed(() =>
  companies.value.filter((e: CompanyModel) => {
    if (!searchQuery.value) return true;
    const searchQueryLower = searchQuery.value.toLowerCase();
    if (e.mName.toLowerCase().includes(searchQueryLower)) return true;
    if (e.mShortDescription.toLowerCase().includes(searchQueryLower))
      return true;
    return false;
  }),
);

async function deleteCompany(id: string) {
  await $dropFetch(`/api/v1/admin/company/:id`, {
    method: "DELETE",
    params: { id },
    failTitle: "Failed to delete company",
  });

  const index = companies.value.findIndex((e) => e.id === id);
  companies.value.splice(index, 1);
}

</script>
