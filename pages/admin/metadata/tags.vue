<template>
  <div class="space-y-6">
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
        <button
          class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="() => (createModalOpen = true)"
        >
          {{ $t("library.admin.metadata.tags.create") }}
        </button>
      </div>
    </div>
    <div class="flex flex-wrap gap-3">
      <div
        v-for="(tag, tagIdx) in tags"
        :key="tag.id"
        class="py-2 px-3 inline-flex gap-x-3 bg-zinc-950 ring-1 ring-zinc-800 text-zinc-300"
      >
        {{ tag.name }}
        <button @click="() => deleteTag(tagIdx)">
          <TrashIcon
            class="transition size-4 text-zinc-700 hover:text-red-500"
          />
        </button>
      </div>
    </div>
    <ModalCreateTag v-model="createModalOpen" @created="onTagCreate" />
  </div>
</template>

<script setup lang="ts">
import { TrashIcon } from "@heroicons/vue/24/outline";
import type { SerializeObject } from "nitropack";
import type { GameTagModel } from "~/prisma/client/models";

definePageMeta({
  layout: "admin",
});

const createModalOpen = ref(false);

const tags = ref(
  await $dropFetch<Array<SerializeObject<GameTagModel>>>("/api/v1/admin/tags"),
);

function sort() {
  tags.value.sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );
}

sort();

async function onTagCreate(tag: GameTagModel) {
  tags.value.push(tag);
  sort();
}

async function deleteTag(tagIdx: number) {
  const tag = tags.value[tagIdx];
  await $dropFetch(`/api/v1/admin/tags/${tag.id}`, {
    method: "DELETE",
    failTitle: "Failed to delete tag",
  });
  tags.value.splice(tagIdx, 1);
}
</script>
