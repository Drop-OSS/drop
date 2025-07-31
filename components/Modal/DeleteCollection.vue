<template>
  <ModalTemplate :model-value="!!collection">
    <template #default>
      <div>
        <DialogTitle
          as="h3"
          class="text-lg font-bold font-display text-zinc-100"
        >
          {{ $t("library.collection.delete") }}
        </DialogTitle>
        <p class="mt-1 text-sm text-zinc-400">
          {{ $t("common.deleteConfirm", [collection?.name]) }}
        </p>
        <p class="mt-2 text-sm font-bold text-red-500">
          {{ $t("common.cannotUndo") }}
        </p>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        :loading="deleteLoading"
        class="bg-red-600 text-white hover:bg-red-500"
        @click="() => deleteCollection()"
      >
        {{ $t("delete") }}
      </LoadingButton>
      <button
        class="inline-flex items-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold font-display text-white hover:bg-zinc-700"
        @click="() => (collection = undefined)"
      >
        {{ $t("cancel") }}
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import type { CollectionModel } from "~/prisma/client/models";
import { DialogTitle } from "@headlessui/vue";

const collection = defineModel<CollectionModel | undefined>();
const deleteLoading = ref(false);

const collections = await useCollections();
const { t } = useI18n();

async function deleteCollection() {
  try {
    if (!collection.value) return;

    deleteLoading.value = true;
    await $dropFetch(`/api/v1/collection/:id`, {
      method: "DELETE",
      params: {
        id: collection.value.id,
      },
    });
    const index = collections.value.findIndex(
      (e) => e.id == collection.value?.id,
    );
    collections.value.splice(index, 1);

    collection.value = undefined;
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: t("errors.library.add.title"),
        description: t("errors.library.add.desc", [
          // @ts-expect-error attempt to display statusMessage on error
          e?.statusMessage ?? t("errors.unknown"),
        ]),
      },
      (_, c) => c(),
    );
  } finally {
    deleteLoading.value = false;
  }
}
</script>
