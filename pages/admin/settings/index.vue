<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-zinc-100">
          {{ t("settings.title") }}
        </h1>
        <p class="mt-2 text-base text-zinc-400">
          {{ t("settings.subheader") }}
        </p>
      </div>
    </div>
    <h2 class="text-xl font-semibold text-zinc-100">
      {{ t("settings.store.title") }}
    </h2>

    <form class="space-y-4" @submit.prevent="() => saveSettings()">
      <h3
        class="text-base font-medium text-gray-900 dark:text-gray-300 mb-3 m-x-0"
      >
        {{ t("settings.admin.showTitleDescriptionOnGamePanel") }}
      </h3>
      <ul class="flex gap-3">
        <li v-if="!!dummyData.gamePanel" class="inline-block">
          <OptionWrapper
            :active="showTitleDescriptionOnGamePanel"
            @click="setShowTitleDescription(true)"
          >
            <div class="flex">
              <GamePanel :game="dummyData.gamePanel" :animate="false" />
            </div>
          </OptionWrapper>
        </li>
        <li v-if="!!dummyData.gamePanel" class="inline-block">
          <OptionWrapper
            :active="!showTitleDescriptionOnGamePanel"
            @click="setShowTitleDescription(false)"
          >
            <div class="flex">
              <GamePanel
                :game="dummyData.gamePanel"
                :show-title-description="false"
                :animate="false"
              />
            </div>
          </OptionWrapper>
        </li>
      </ul>
      <LoadingButton
        type="submit"
        class="inline-flex w-full shadow-sm sm:ml-3 sm:w-auto"
        :loading="isSaving"
      >
        {{ $t("save") }}
      </LoadingButton>
    </form>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

definePageMeta({
  layout: "admin",
});

useHead({
  title: t("settings.title"),
});

const settings = await $dropFetch("/api/v1/admin/settings");
const dummyData = await $dropFetch("/api/v1/admin/settings/dummy-data");

const showTitleDescriptionOnGamePanel = ref<boolean>(
  settings.showTitleDescriptionOnGamePanel,
);
const setShowTitleDescription = (value: boolean) =>
  (showTitleDescriptionOnGamePanel.value = value);

const isSaving = ref<boolean>(false);
const saveSettings = async () => {
  isSaving.value = true;
  const payload = {
    showTitleDescriptionOnGamePanel: showTitleDescriptionOnGamePanel.value,
  };
  await $dropFetch("/api/v1/admin/settings", {
    method: "PATCH",
    body: payload,
  });
  isSaving.value = false;
};
</script>
