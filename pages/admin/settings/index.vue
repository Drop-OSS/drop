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
              name="serverNname"
              :placeholder="$t('settings.admin.general.serverNamePlaceholder')"
              class="block w-full rounded-md bg-zinc-800 px-3 py-1.5 text-base text-zinc-100 outline outline-1 -outline-offset-1 outline-zinc-700 placeholder:text-zinc-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600 sm:text-sm/6"
            />
          </div>
        </div>

        <div class="mt-4">
          <label for="logo" class="block text-sm/6 font-medium text-zinc-100">{{
            $t("settings.admin.general.logo")
          }}</label>
          <ul class="flex gap-3">
            <li class="flex flex-col w-40">
              <div class="flex grow max-w-25 p-2 mx-auto text-right">
                <div class="grow flex items-center">
                  <ImageUpload
                    :hover-text="$t('settings.admin.general.uploadLogo')"
                    :open-modal="openModal"
                    :object-id="mCustomLogoObjectId"
                    :image-alt="$t('settings.admin.general.applicationLogo')"
                  />
                </div>
              </div>
              <label
                class="text-zinc-100 mt-2 text-sm text-center mb-2 mx-auto"
              >
                <div class="flex items-center">
                  <input
                    v-model="settings.generalSettings.mLogoObjectId"
                    class="mr-1"
                    type="radio"
                    name="mLogoObjectId"
                    :checked="settings.generalSettings.mLogoObjectId !== null"
                    :value="mCustomLogoObjectId"
                  />
                  {{ $t("settings.admin.general.customLogo") }}
                </div>
              </label>
            </li>
            <li class="flex flex-col w-35">
              <div class="mx-auto w-25">
                <DropLogo />
              </div>
              <label
                class="text-zinc-100 mt-2 text-sm text-center mb-2 mx-auto"
              >
                <div class="flex items-center">
                  <input
                    v-model="settings.generalSettings.mLogoObjectId"
                    class="mr-1"
                    type="radio"
                    name="isDefaultLogo"
                    :checked="settings.generalSettings.mLogoObjectId === null"
                    :value="null"
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
      >
        {{ $t("common.save") }}
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

const mCustomLogoObjectId = ref<string | null>(
  settings.value.generalSettings.mLogoObjectId,
);

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
}
</script>
