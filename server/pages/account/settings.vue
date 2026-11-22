<template>
  <div>
    <div class="border-b border-zinc-800 pb-4 w-full">
      <h2
        class="text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
      >
        {{ $t("account.settings") }}
      </h2>
    </div>

    <div class="mt-6 max-w-xl">
      <h3 class="text-base font-semibold text-zinc-100">
        {{ $t("account.hiddenTags.title") }}
      </h3>
      <ul
        v-if="tags.length > 0"
        class="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900"
      >
        <li v-for="tag in tags" :key="tag.id" class="px-4 py-3">
          <SwitchGroup as="div" class="flex items-center justify-between">
            <SwitchLabel as="span" class="text-sm/6 font-medium text-zinc-100">
              {{ tag.name }}
            </SwitchLabel>
            <Switch
              :model-value="hidden.has(tag.id)"
              :disabled="saving"
              :class="[
                hidden.has(tag.id) ? 'bg-blue-600' : 'bg-zinc-800',
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50',
              ]"
              @update:model-value="(v: boolean) => setHidden(tag.id, v)"
            >
              <span
                aria-hidden="true"
                :class="[
                  hidden.has(tag.id) ? 'translate-x-5' : 'translate-x-0',
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                ]"
              />
            </Switch>
          </SwitchGroup>
        </li>
      </ul>
      <p v-else class="mt-3 text-sm text-zinc-400">
        {{ $t("account.hiddenTags.none") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Switch, SwitchGroup, SwitchLabel } from "@headlessui/vue";
import type { GameTagModel } from "~/prisma/client/models";
import type { SerializeObject } from "nitropack";

definePageMeta({
  layout: "default",
});

const { t } = useI18n();

useHead({
  title: t("account.settings"),
});

const tags =
  await $dropFetch<Array<SerializeObject<GameTagModel>>>("/api/v1/store/tags");
const hidden = ref(
  new Set(await $dropFetch<string[]>("/api/v1/user/hiddentags")),
);
const saving = ref(false);

async function setHidden(id: string, hide: boolean) {
  const next = new Set(hidden.value);
  if (hide) next.add(id);
  else next.delete(id);
  saving.value = true;
  try {
    hidden.value = new Set(
      await $dropFetch<string[]>("/api/v1/user/hiddentags", {
        method: "PUT",
        body: { tags: [...next] },
        failTitle: t("account.hiddenTags.saveFailed"),
      }),
    );
  } finally {
    saving.value = false;
  }
}
</script>
