<template>
  <ModalTemplate v-model="open">
    <template #default>
      <div>
        <h3 class="text-lg font-medium leading-6 text-white">
          {{ $t("library.admin.metadata.companies.modals.createTitle") }}
        </h3>
        <p class="mt-1 text-zinc-400 text-sm">
          {{ $t("library.admin.metadata.companies.modals.createDescription") }}
        </p>
      </div>
      <div class="mt-2">
        <form class="space-y-4" @submit.prevent="() => createCompany()">
          <div>
            <label
              for="name"
              class="block text-sm/6 font-medium text-zinc-100"
              >{{
                $t("library.admin.metadata.companies.modals.createFieldName")
              }}</label
            >
            <div class="mt-2">
              <input
                id="name"
                v-model="companyName"
                type="text"
                name="name"
                :placeholder="
                  $t(
                    'library.admin.metadata.companies.modals.createFieldNamePlaceholder',
                  )
                "
                class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
              />
            </div>
          </div>
          <div>
            <label
              for="description"
              class="block text-sm/6 font-medium text-zinc-100"
              >{{
                $t(
                  "library.admin.metadata.companies.modals.createFieldDescription",
                )
              }}</label
            >
            <div class="mt-2">
              <input
                id="description"
                v-model="companyDescription"
                type="text"
                name="description"
                :placeholder="
                  $t(
                    'library.admin.metadata.companies.modals.createFieldDescriptionPlaceholder',
                  )
                "
                class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
              />
            </div>
          </div>
          <div>
            <label
              for="website"
              class="block text-sm/6 font-medium text-zinc-100"
              >{{
                $t("library.admin.metadata.companies.modals.createFieldWebsite")
              }}</label
            >
            <div class="mt-2">
              <input
                id="website"
                v-model="companyWebsite"
                type="text"
                name="website"
                :placeholder="
                  $t(
                    'library.admin.metadata.companies.modals.createFieldWebsitePlaceholder',
                  )
                "
                class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
              />
            </div>
          </div>

          <button class="hidden" type="submit" />
        </form>
      </div>
    </template>

    <template #buttons="{ close }">
      <LoadingButton
        :loading="loading"
        :disabled="!companyValid"
        class="w-full sm:w-fit"
        @click="() => createCompany()"
      >
        {{ $t("common.create") }}
      </LoadingButton>
      <button
        ref="cancelButtonRef"
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-800 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="() => close()"
      >
        {{ $t("cancel") }}
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import type { CompanyModel } from "~/prisma/client/models";

const open = defineModel<boolean>({ required: true });

const emit = defineEmits<{
  created: [company: CompanyModel];
}>();

const companyName = ref("");
const companyDescription = ref("");
const companyWebsite = ref("");

const loading = ref(false);
const companyValid = computed(
  () => companyName.value && companyDescription.value,
);
async function createCompany() {
  loading.value = true;
  try {
    const newCompany = await $dropFetch("/api/v1/admin/company", {
      method: "POST",
      body: {
        name: companyName.value,
        description: companyDescription.value,
        website: companyWebsite.value,
      },
      failTitle: "Failed to create new company",
    });
    open.value = false;
    emit("created", newCompany);
  } finally {
    /* empty */
  }
  loading.value = false;
}
</script>
