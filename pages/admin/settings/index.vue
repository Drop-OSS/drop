<template>
  <div>
    <form class="space-y-4" @submit.prevent="() => saveSettings()">
      <div class="pb-4 border-b border-zinc-700 w-2xl mt-2">
        <h2 class="text-xl font-semibold text-zinc-100">
          {{ $t("settings.admin.general.title") }}
        </h2>

        <div class="mt-4">
          <label
            for="serverName"
            class="block text-sm/6 font-medium text-zinc-100"
            >{{ $t("settings.admin.general.serverName") }}</label
          >
          <div class="mt-2">
            <input
              id="name"
              v-model="settings.generalSettings.serverName"
              type="text"
              name="serverName"
              :placeholder="$t('settings.admin.general.serverNamePlaceholder')"
              class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
              @input="(event) => updateServerName(event)"
            />
          </div>
        </div>

        <div class="mt-4">
          <p for="logo" class="block text-sm/6 font-medium text-zinc-100">
            {{ $t("settings.admin.general.logo") }}
          </p>
          <ul class="flex gap-3">
            <li class="w-40 flex flex-col items-center">
              <div class="flex items-center max-w-25 mt-2 mb-2 h-full">
                <ImageUpload
                  :hover-text="$t('settings.admin.general.uploadLogo')"
                  :open-modal="openModal"
                  :object-id="mCustomLogoObjectId"
                  :image-alt="$t('settings.admin.general.applicationLogo')"
                />
              </div>
              <label class="flex flex-col text-zinc-100 text-sm items-center">
                <div class="flex items-center">
                  <input
                    v-model="settings.generalSettings.mLogoObjectId"
                    class="mr-1"
                    type="radio"
                    name="mLogoObjectId"
                    :value="mCustomLogoObjectId"
                    @input="updateFormLogo"
                  />
                  {{ $t("settings.admin.general.customLogo") }}
                </div>
              </label>
            </li>
            <li class="w-40 flex flex-col items-center">
              <div class="flex w-25 mt-2 mb-2 h-full">
                <DropLogo @click="() => updateFormLogo(null)" />
              </div>
              <label class="flex flex-col text-zinc-100 text-sm items-center">
                <div class="flex items-center">
                  <input
                    v-model="settings.generalSettings.mLogoObjectId"
                    class="mr-1"
                    type="radio"
                    name="isDefaultLogo"
                    :checked="settings.generalSettings.mLogoObjectId === null"
                    :value="null"
                    @input="() => updateFormLogo(null)"
                  />
                  {{ $t("settings.admin.general.defaultLogo") }}
                </div>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <ModalUploadFile
        v-model="uploadLogoOpen"
        :endpoint="`/api/v1/admin/settings/logo`"
        accept="image/*"
        @upload="updateLogo"
      />

      <LoadingButton
        type="submit"
        class="inline-flex w-full shadow-sm sm:w-auto"
        :loading="saving"
        :disabled="!allowSave"
      >
        {{ allowSave ? $t("common.save") : $t("common.saved") }}
      </LoadingButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import { FetchError } from "ofetch";
import type { Settings } from "~/server/internal/utils/types";

const { t } = useI18n();

definePageMeta({
  layout: "admin",
});

useHead({
  title: t("settings.admin.title"),
});

const settings = ref<Settings>(await $dropFetch("/api/v1/settings"));

const allowSave = ref<boolean>(false);
const uploadLogoOpen = ref<boolean>(false);

const mCustomLogoObjectId = ref<string>(
  settings.value.generalSettings.mLogoObjectId || "",
);

const updateServerName = (event: InputEvent) => {
  settings.value.generalSettings.serverName =
    (event.target as HTMLInputElement)?.value || "";
  allowSave.value = true;
};

const openModal = () => {
  uploadLogoOpen.value = true;
};

const saving = ref<boolean>(false);

async function saveSettings() {
  saving.value = true;
  try {
    settings.value = await $dropFetch("/api/v1/admin/settings", {
      method: "PATCH",
      body: {
        generalSettings: {
          serverName: settings.value.generalSettings.serverName,
          mLogoObjectId: settings.value.generalSettings.mLogoObjectId,
        },
      },
    });
    window.location.reload();
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

function updateLogo(response: { id: string }) {
  mCustomLogoObjectId.value = response.id;
  settings.value.generalSettings.mLogoObjectId = response.id;
  allowSave.value = true;
}

const updateFormLogo = (event: InputEvent | null) => {
  settings.value.generalSettings.mLogoObjectId =
    (event?.target as HTMLInputElement)?.value || null;
  allowSave.value = true;
};
</script>
