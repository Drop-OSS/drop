<template>
  <NuxtLoadingIndicator color="#2563eb" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ModalStack />
  <div
    v-if="showExternalUrlWarning"
    class="fixed flex flex-row gap-x-2 right-0 bottom-0 m-2 px-2 py-2 z-50 text-right bg-red-700/90 rounded-lg"
  >
    <div class="flex flex-col">
      <span class="text-sm text-zinc-200 font-bold font-display">{{
        $t("errors.externalUrl.title")
      }}</span>
      <span class="text-xs text-red-400">{{
        $t("errors.externalUrl.subtitle")
      }}</span>
    </div>
    <button class="text-red-200" @click="() => hideExternalURL()">
      <XMarkIcon class="size-5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/outline";

await updateUser();

const user = useUser();
const apiDetails = await $dropFetch("/api/v1");
const clientMode = isClientRequest();

const showExternalUrlWarning = ref(false);
function checkExternalUrl() {
  if (!import.meta.client || clientMode) return;
  const realOrigin = window.location.origin.trim();
  const chosenOrigin = apiDetails.external.trim();
  const ignore = window.localStorage.getItem("ignoreExternalUrl");
  if (ignore && ignore == "true") return;
  showExternalUrlWarning.value = !(realOrigin == chosenOrigin);
}

function hideExternalURL() {
  window.localStorage.setItem("ignoreExternalUrl", "true");
  showExternalUrlWarning.value = false;
}

if (user.value?.admin) {
  onMounted(() => {
    checkExternalUrl();
  });
}
</script>
