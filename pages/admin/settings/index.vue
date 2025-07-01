<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-zinc-100">
          {{ $t("settings.title") }}
        </h1>
        <p class="mt-2 text-base text-zinc-400">
          {{ $t("settings.subheader") }}
        </p>
      </div>
    </div>
    <h2 class="text-xl font-semibold text-zinc-100">
      {{ $t("settings.store.title") }}
    </h2>

    <form class="space-y-4" @submit.prevent="() => saveSettings()">
      <h3
        class="text-base font-medium text-gray-900 dark:text-gray-300 mb-3 m-x-0"
      >
        {{ $t("settings.store.showGamePanelTextDecoration") }}
      </h3>
      <ul class="flex gap-3">
        <li class="inline-block">
          <OptionWrapper
            :active="showGamePanelTextDecoration"
            @click="setShowTitleDescription(true)"
          >
            <div class="flex">
              <GamePanel
                :animate="false"
                :game="game"
                :no-games-defaults-to-placeholder="true"
              />
            </div>
          </OptionWrapper>
        </li>
        <li class="inline-block">
          <OptionWrapper
            :active="!showGamePanelTextDecoration"
            @click="setShowTitleDescription(false)"
          >
            <div class="flex">
              <GamePanel
                :game="game"
                :show-title-description="false"
                :animate="false"
                :no-games-defaults-to-placeholder="true"
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
const { game } = await $dropFetch("/api/v1/admin/settings/dummy-data");

const showGamePanelTextDecoration = ref<boolean>(
  settings.showGamePanelTextDecoration,
);
const setShowTitleDescription = (value: boolean) =>
  (showGamePanelTextDecoration.value = value);

const isSaving = ref<boolean>(false);
const saveSettings = async () => {
  isSaving.value = true;
  const payload = {
    showGamePanelTextDecoration: showGamePanelTextDecoration.value,
  };
  await $dropFetch("/api/v1/admin/settings", {
    method: "PATCH",
    body: payload,
  });
  isSaving.value = false;
};
</script>
