<template>
  <ModalTemplate>
    <template #default>
      <DialogTitle as="h3" class="text-lg font-bold font-display text-zinc-100">
        Delete Collection
      </DialogTitle>
      <div class="mt-2">
        <p class="text-sm text-zinc-400">
          Are you sure you want to delete "{{ collection?.name }}"? This action
          cannot be undone.
        </p>
      </div>
    </template>
    <template #buttons="{ close }">
      <button
        @click="() => close()"
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
      >
        Cancel
      </button>
      <LoadingButton
        :loading="deleteLoading"
        @click="() => handleDelete()"
        class="bg-red-600 text-white hover:bg-red-500"
      >
        Delete
      </LoadingButton>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import type { Collection } from "@prisma/client";
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogPanel,
  DialogTitle,
} from "@headlessui/vue";

const props = defineProps<{
  collection: Collection | null;
}>();

const emit = defineEmits<{
  deleted: [collectionId: string];
}>();

const open = defineModel<boolean>();
const deleteLoading = ref(false);

const collections = await useCollections();

const handleDelete = async () => {
  if (!props.collection) return;

  deleteLoading.value = true;
  try {
    await $fetch(`/api/v1/collection/${props.collection.id}`, {
      // @ts-ignore
      method: "DELETE",
    });

    collections.value.splice(
      collections.value.findIndex((e) => e.id === props.collection?.id),
      1
    );

    open.value = false;
    emit("deleted", props.collection.id);
  } catch (error) {
    console.error("Failed to delete collection:", error);

    const err = error as { statusMessage?: string };
    createModal(
      ModalType.Notification,
      {
        title: "Failed to create collection",
        description: `Drop couldn't create your collection: ${err?.statusMessage}`,
      },
      (_, c) => c()
    );
  } finally {
    deleteLoading.value = false;
  }
};
</script>
