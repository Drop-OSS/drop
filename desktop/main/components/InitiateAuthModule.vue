<template>
  <div
    class="grid min-h-full grid-cols-1 grid-rows-[1fr,auto,1fr] lg:grid-cols-[max(50%,36rem),1fr]"
  >
    <header
      class="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:px-8"
    >
      <Logo class="h-10 w-auto sm:h-12" />
    </header>
    <main
      class="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:px-8"
    >
      <div class="max-w-lg">
        <slot />
        <div class="mt-10">
          <div>
            <div v-if="loading" role="status">
              <svg
                aria-hidden="true"
                class="w-5 h-5 text-transparent animate-spin fill-white"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span class="sr-only">Loading...</span>
            </div>
            <span class="inline-flex gap-x-8 items-center" v-else>
              <button
                type="button"
                @click="() => authWrapper_wrapper()"
                :disabled="loading"
                class="px-3 py-1 inline-flex items-center gap-x-2 bg-zinc-700 rounded text-sm text-left font-semibold leading-7 text-white"
              >
                Sign in with your browser <ArrowTopRightOnSquareIcon class="size-4" />
              </button>
              <NuxtLink href="/auth/code" class="text-zinc-100 text-sm hover:text-zinc-300">
                Use a code &rarr;
              </NuxtLink>
            </span>
          </div>

          <div class="mt-5" v-if="offerManual">
            <h1 class="text-zinc-100 font-semibold">Having trouble?</h1>
            <p class="mt-1 text-zinc-400 text-sm">
              You can manually enter the token from your web browser.
            </p>
            <div class="inline-flex gap-x-1 mt-2 w-full">
              <input
                id="token"
                name="token"
                type="text"
                autocomplete="token"
                required
                class="grow block w-full rounded-md border-0 py-1.5 px-3 shadow-sm bg-zinc-950/20 text-zinc-300 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                v-model="manualToken"
              />
              <LoadingButton
                :loading="manualLoading"
                @click="() => continueManual_wrapper()"
                class="w-fit"
              >
                Submit
              </LoadingButton>
            </div>
          </div>

          <div v-if="error" class="mt-5 rounded-md bg-red-600/10 p-4">
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
      </div>
    </main>
    <footer class="self-end lg:col-span-2 lg:col-start-1 lg:row-start-3">
      <div class="border-t border-blue-600 bg-zinc-900 py-10">
        <nav
          class="mx-auto flex w-full max-w-7xl items-center gap-x-4 px-6 text-sm leading-7 text-zinc-400 lg:px-8"
        >
          <a href="#">Documentation</a>
          <svg viewBox="0 0 2 2" aria-hidden="true" class="h-0.5 w-0.5 fill-zinc-700">
            <circle cx="1" cy="1" r="1" />
          </svg>
          <a href="#">Troubleshooting</a>
          <svg viewBox="0 0 2 2" aria-hidden="true" class="h-0.5 w-0.5 fill-zinc-700">
            <circle cx="1" cy="1" r="1" />
          </svg>
          <NuxtLink to="/setup/server">Switch instance</NuxtLink>
        </nav>
      </div>
    </footer>
    <div class="hidden lg:relative lg:col-start-2 lg:row-start-1 lg:row-end-4 lg:block">
      <img
        src="@/assets/wallpaper.jpg"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/16/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/20/solid";
import { invoke } from "@tauri-apps/api/core";

const loading = ref(false);
const error = ref<string | undefined>();

let offerManualTimeout: NodeJS.Timeout | undefined;
const offerManual = ref(false);
const manualToken = ref("");
const manualLoading = ref(false);

async function auth() {
  await invoke("auth_initiate");
}

function authWrapper_wrapper() {
  error.value = undefined;
  loading.value = true;
  auth().catch((e) => {
    loading.value = false;
    error.value = e;
    if (offerManualTimeout) clearTimeout(offerManualTimeout);
  });
  offerManualTimeout = setTimeout(() => {
    offerManual.value = true;
  }, 2000);
}

async function continueManual() {
  await invoke("manual_recieve_handshake", { token: manualToken.value });
}

function continueManual_wrapper() {
  loading.value = true;
  continueManual()
    .catch((e) => {
      error.value = e;
    })
    .finally(() => {
      loading.value = false;
    });
}
</script>
