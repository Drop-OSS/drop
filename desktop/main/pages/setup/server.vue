<template>
  <div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm flex flex-col items-center">
      <Wordmark />
      <h2
        class="mt-10 text-center text-2xl font-bold font-display leading-9 tracking-tight text-zinc-100"
      >
        Connect to your Drop instance
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="space-y-6" @submit.prevent="connect_wrapper">
        <div>
          <label for="company-website" class="block text-sm font-medium leading-6 text-zinc-100"
            >Drop instance address</label
          >
          <div class="mt-2">
            <div
              class="flex rounded-md shadow-sm ring-1 ring-inset ring-zinc-700 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-600 sm:max-w-md"
            >
              <span
                v-if="showHttps"
                class="flex select-none items-center pl-3 text-zinc-500 -mr-2.5 sm:text-sm"
                >https://</span
              >
              <input
                type="text"
                name="company-website"
                id="company-website"
                v-model="url"
                class="block flex-1 border-0 bg-transparent py-1.5 text-zinc-100 placeholder:text-zinc-400 focus:ring-0 sm:text-sm sm:leading-6"
                placeholder="www.example.com"
              />
            </div>
          </div>
        </div>

        <div>
          <LoadingButton :loading="loading" class="w-full"> Continue -> </LoadingButton>
        </div>

        <div v-if="error" class="mt-1 rounded-md bg-red-600/10 p-4">
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
      </form>

      <p class="mt-10 text-center text-sm text-zinc-500">
        Don't have one?
        {{ " " }}
        <a
          href="https://github.com/Drop-OSS"
          target="_blank"
          class="font-semibold leading-6 text-blue-600 hover:text-blue-500"
          >Host your own instance -></a
        >
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/16/solid";
import { invoke } from "@tauri-apps/api/core";

definePageMeta({
  layout: "mini",
});

const url = ref("");
const error = ref(undefined);
const loading = ref(false);

const router = useRouter();
const showHttps = computed(() => {
  const prefixes = ["http://", "https://"];

  const doesntHavePrefix = !prefixes.some((e) =>
    url.value.startsWith(e.slice(0, url.value.length)),
  );

  return doesntHavePrefix;
});

async function connect() {
  const newUrl = url.value.startsWith("http") ? url.value : `https://${url.value}`;

  const result = await invoke("use_remote", { url: newUrl });
  router.push("/auth");
}

function connect_wrapper() {
  loading.value = true;
  error.value = undefined;
  connect()
    .then(() => {})
    .catch((e) => {
      console.log(e);
      error.value = e;
    })
    .finally(() => {
      loading.value = false;
    });
}
</script>
