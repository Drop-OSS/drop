<template>
  <div class="border-b border-surface-700 py-5">
    <h3 class="text-base font-semibold font-display leading-6 text-ink-100">
      General
    </h3>
  </div>

  <div class="mt-5 flex flex-col gap-4">
    <div class="flex flex-row items-center justify-between">
      <div>
        <h3 class="text-sm font-medium leading-6 text-ink-100">Sign out</h3>
        <p class="mt-1 text-sm leading-6 text-ink-400">
          Sign out of your Drop account on this device
        </p>
      </div>
      <button
        @click="signOut"
        type="button"
        class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        Sign out
      </button>
    </div>

    <div v-if="error" class="rounded-md bg-red-600/10 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-600">
            {{ error }}
          </h3>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useRouter } from "#imports";
import { XCircleIcon } from "@heroicons/vue/16/solid";

const router = useRouter();
const error = ref<string | null>(null);

// Listen for auth events
onMounted(async () => {
  await listen("auth/signedout", () => {
    router.push("/auth/signedout");
  });
});

async function signOut() {
  try {
    error.value = null;
    await invoke("sign_out");
  } catch (e) {
    error.value = `Failed to sign out: ${e}`;
  }
}
</script>
