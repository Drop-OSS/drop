<template>
  <ModalTemplate v-model="open">
    <template #default>
      <div>
        <DialogTitle as="h3" class="text-lg font-medium leading-6 text-white">
          {{ $t("library.admin.metadata.tags.modal.title") }}
        </DialogTitle>
        <p class="mt-1 text-zinc-400 text-sm">
          {{ $t("library.admin.metadata.tags.modal.description") }}
        </p>
      </div>
      <div class="mt-2">
        <form @submit.prevent="() => createTag()">
          <input
            v-model="tagName"
            type="text"
            class="block w-full rounded-md border-0 bg-zinc-800 py-1.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          />
          <button class="hidden" type="submit" />
        </form>
      </div>
    </template>

    <template #buttons="{ close }">
      <LoadingButton
        :loading="createTagLoading"
        :disabled="!tagName"
        class="w-full sm:w-fit"
        @click="() => createTag()"
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
import { ref } from "vue";
import { DialogTitle } from "@headlessui/vue";
import type {
  GameTagModel,
} from "~/prisma/client/models";

const emit = defineEmits<{
  created: [tag: GameTagModel];
}>();

const open = defineModel<boolean>({ required: true });

const tagName = ref("");
const createTagLoading = ref(false);

async function createTag() {
  if (!tagName.value || createTagLoading.value) return;

  createTagLoading.value = true;

  // Create the collection
  const tag = await $dropFetch("/api/v1/admin/tags", {
    method: "POST",
    body: { name: tagName.value },
    failTitle: "Failed to create tag",
  });

  // Reset and emit
  tagName.value = "";
  open.value = false;

  emit("created", tag);
  createTagLoading.value = false;
}
</script>
