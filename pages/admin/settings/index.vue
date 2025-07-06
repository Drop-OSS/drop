<template>
  <div class="space-y-4">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-zinc-100">
          {{ $t("settings.admin.title") }}
        </h1>
        <p class="mt-2 text-base text-zinc-400">
          {{ $t("settings.admin.description") }}
        </p>
      </div>
    </div>

    <form class="space-y-4" @submit.prevent="() => saveSettings()">
      <div class="py-6 border-y border-zinc-700">
        <h2 class="text-xl font-semibold text-zinc-100">
          {{ $t("settings.admin.store.title") }}
        </h2>

        <h3 class="text-base font-medium text-zinc-400 mb-3 m-x-0">
          {{ $t("settings.admin.store.showGamePanelTextDecoration") }}
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
                  :default-placeholder="true"
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
                  :default-placeholder="true"
                />
              </div>
            </OptionWrapper>
          </li>
        </ul>
      </div>

      <LoadingButton
        type="submit"
        class="inline-flex w-full shadow-sm sm:w-auto"
        :loading="saving"
        :disabled="!allowSave"
      >
        {{ allowSave ? $t("save") : $t("saved") }}
      </LoadingButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import { FetchError } from "ofetch";

const { t } = useI18n();

definePageMeta({
  layout: "admin",
});

useHead({
  title: t("settings.admin.title"),
});

const settings = await $dropFetch("/api/v1/admin/settings");
const { game } = await $dropFetch("/api/v1/admin/settings/dummy-data");

const allowSave = ref(false);

const showGamePanelTextDecoration = ref<boolean>(
  settings.showGamePanelTextDecoration,
);

function setShowTitleDescription(value: boolean) {
  showGamePanelTextDecoration.value = value;
  allowSave.value = true;
}

const saving = ref<boolean>(false);
async function saveSettings() {
  saving.value = true;
  try {
    await $dropFetch("/api/v1/admin/settings", {
      method: "PATCH",
      body: {
        showGamePanelTextDecoration: showGamePanelTextDecoration.value,
      },
    });
  } catch (e) {
    createModal(
      ModalType.Notification,
      {
        title: `Failed to save settings.`,
        description:
          e instanceof FetchError
            ? (e.statusMessage ?? e.message)
            : (e as string).toString(),
      },
      (_, c) => c(),
    );
  }
  saving.value = false;
  allowSave.value = false;
}
</script>
