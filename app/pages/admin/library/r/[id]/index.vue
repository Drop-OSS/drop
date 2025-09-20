<template>
  <div
    class="pt-8 lg:pt-0 lg:pl-20 fixed inset-0 flex flex-col overflow-auto bg-zinc-900"
  >
    <div
      class="bg-zinc-950 w-full flex flex-col sm:flex-row items-center gap-2 justify-between pr-2"
    >
      <!--start-->
      <div>
        <div class="pt-4 inline-flex gap-x-2">
          <div
            v-for="[value, { icon }] in Object.entries(components)"
            :key="value"
          >
            <button
              :class="[
                'inline-flex items-center gap-x-1 py-2 px-3 rounded-t-md font-semibold text-sm',
                value == currentMode
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'bg-transparent text-zinc-500',
              ]"
              @click="() => (currentMode = value as RedistEditorMode)"
            >
              <component :is="icon" class="size-4" />
              {{ value }}
            </button>
          </div>
        </div>
      </div>
      <div>
        <!-- open in store button -->
      </div>
    </div>
    <component
      :is="components[currentMode].editor"
      v-model="redist"
      :unimported-versions="unimportedVersions"
    />
  </div>
</template>

<script setup lang="ts">
import { GameEditorVersion, RedistEditorMetadata } from "#components";
import { DocumentIcon, ServerStackIcon } from "@heroicons/vue/24/outline";
import type { Component } from "vue";

const route = useRoute();
const redistId = route.params.id.toString();
const { redist: rawRedist, unimportedVersions } = await $dropFetch(
  `/api/v1/admin/redist/:id`,
  { params: { id: redistId } },
);
const redist = ref(rawRedist);

definePageMeta({
  layout: "admin",
});

enum RedistEditorMode {
  Metadata = "Metadata",
  Versions = "Versions",
}

const components: {
  [key in RedistEditorMode]: { editor: Component; icon: Component };
} = {
  [RedistEditorMode.Metadata]: { editor: RedistEditorMetadata, icon: DocumentIcon },
  [RedistEditorMode.Versions]: {
    editor: GameEditorVersion,
    icon: ServerStackIcon,
  },
};

const currentMode = ref<RedistEditorMode>(RedistEditorMode.Metadata);

useHead({
  title: `${currentMode.value} - ${redist.value.mName}`,
});

watch(currentMode, (v) => {
  useHead({
    title: `${v} - ${redist.value.mName}`,
  });
});
</script>
