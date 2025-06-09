<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps({
  error: {
    type: Object as () => NuxtError,
    default: () => ({}),
  },
});

const { t } = useI18n();
const route = useRoute();
const user = useUser();
const statusCode = props.error?.statusCode;
const message =
  props.error?.message || props.error?.statusMessage || t("errors.unknown");
const showSignIn = statusCode ? statusCode == 403 || statusCode == 401 : false;

async function signIn() {
  clearError({
    redirect: `/auth/signin?redirect=${encodeURIComponent(route.fullPath)}`,
  });
}
switch (statusCode) {
  case 401:
  case 403:
    await signIn();
}

useHead({
  title: t("errors.pageTitle", [statusCode ?? message]),
});

if (import.meta.client) {
  console.warn(props.error);
}
</script>

<template>
  <div
    class="grid min-h-screen grid-cols-1 grid-rows-[1fr,auto,1fr] bg-zinc-950 lg:grid-cols-[max(50%,36rem),1fr]"
  >
    <header
      class="mx-auto w-full max-w-7xl px-6 pt-6 sm:pt-10 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:px-8"
    >
      <DropLogo class="h-10 w-auto sm:h-12" />
    </header>
    <main
      class="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:px-8"
    >
      <div class="max-w-lg">
        <p class="text-base font-semibold leading-8 text-blue-600">
          {{ error?.statusCode }}
        </p>
        <h1
          class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl"
        >
          {{ $t("errors.ohNo") }}
        </h1>
        <p
          v-if="message"
          class="mt-3 font-bold text-base leading-7 text-red-500"
        >
          {{ message }}
        </p>
        <p class="mt-6 text-base leading-7 text-zinc-400">
          {{ $t("errors.occurred") }}
        </p>
        <!-- <p>{{ error. }}</p> -->
        <div class="mt-10">
          <!-- full app reload to fix errors -->
          <NuxtLink
            v-if="user && !showSignIn"
            to="/"
            class="text-sm font-semibold leading-7 text-blue-600"
          >
            <i18n-t keypath="errors.backHome" tag="span" scope="global">
              <template #arrow>
                <span aria-hidden="true">{{ $t("chars.arrowBack") }}</span>
              </template>
            </i18n-t>
          </NuxtLink>
          <button
            v-else
            class="text-sm font-semibold leading-7 text-blue-600"
            @click="signIn"
          >
            <i18n-t keypath="errors.signIn" tag="span" scope="global">
              <template #arrow>
                <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
              </template>
            </i18n-t>
          </button>
        </div>
      </div>
    </main>
    <footer class="self-end lg:col-span-2 lg:col-start-1 lg:row-start-3">
      <div class="border-t border-zinc-700 bg-zinc-900 py-10">
        <nav
          class="mx-auto flex w-full max-w-7xl items-center gap-x-4 px-6 text-sm leading-7 text-zinc-400 lg:px-8"
        >
          <NuxtLink href="/docs">{{ $t("footer.documentation") }}</NuxtLink>
          <svg
            viewBox="0 0 2 2"
            aria-hidden="true"
            class="h-0.5 w-0.5 fill-zinc-600"
          >
            <circle cx="1" cy="1" r="1" />
          </svg>
          <NuxtLink to="https://discord.gg/NHx46XKJWA" target="_blank">
            {{ $t("errors.support") }}
          </NuxtLink>
        </nav>
      </div>
    </footer>
    <div
      class="hidden lg:relative lg:col-start-2 lg:row-start-1 lg:row-end-4 lg:block"
    >
      <img
        src="/wallpapers/error-wallpaper.jpg"
        class="absolute inset-0 h-full w-full object-cover"
        alt=""
      />
    </div>
  </div>
</template>
