<template>
  <ModalTemplate :modelValue="!!collection">
    <template #default>
      <div>
        <DialogTitle
          as="h3"
          class="text-lg font-bold font-display text-zinc-100"
        >
          Delete Collection
        </DialogTitle>
        <p class="mt-1 text-sm text-zinc-400">
          Are you sure you want to delete "{{ collection?.name }}"?
        </p>
        <p class="mt-2 text-sm font-bold text-red-500">
          This action cannot be undone.
        </p>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        :loading="deleteLoading"
        @click="() => deleteCollection()"
        class="bg-red-600 text-white hover:bg-red-500"
      >
        Delete
      </LoadingButton>
      <button
        @click="() => (collection = undefined)"
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import type { Collection } from "@prisma/client";
import { DialogTitle } from "@headlessui/vue";

const collection = defineModel<Collection | undefined>();
const deleteLoading = ref(false);

const collections = await useCollections();

async function deleteCollection() {
  try {
    if (!collection.value) return;

    deleteLoading.value = true;
    await $fetch(`/api/v1/collection/${collection.value.id}`, {
      // @ts-ignore
      method: "DELETE",
    });
    const index = collections.value.findIndex(
      (e) => e.id == collection.value?.id
    );
    collections.value.splice(index, 1);

    collection.value = undefined;
  } catch (e: any) {
    createModal(
      ModalType.Notification,
      {
        title: "Failed to add game to library",
        description: `Drop couldn't add this game to your library: ${e?.statusMessage}`,
      },
      (_, c) => c()
    );
  } finally {
    deleteLoading.value = false;
  }
}
</script>
