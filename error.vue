<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps({
  error: Object as () => NuxtError,
});

const route = useRoute();
const user = useUser();
const statusCode = props.error?.statusCode;
const message =
  props.error?.statusMessage ||
  props.error?.message ||
  "An unknown error occurred.";
const showSignIn = statusCode ? statusCode == 403 || statusCode == 401 : false;

async function signIn() {
  clearError({
    redirect: `/auth/signin?redirect=${encodeURIComponent(route.fullPath)}`,
  });
}

useHead({
  title: `${statusCode ?? message} | Drop`,
});

if (import.meta.client) {
  console.log(props.error);
}
</script>

<template>
  <div
    class="grid min-h-screen grid-cols-1 grid-rows-[1fr,auto,1fr] bg-zinc-950 lg:grid-cols-[max(50%,36rem),1fr]"
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
        <p class="text-base font-semibold leading-8 text-blue-600">
          {{ error?.statusCode }}
        </p>
        <h1
          class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl"
        >
          Oh no!
        </h1>
        <p
          v-if="message"
          class="mt-3 font-bold text-base leading-7 text-red-500"
        >
          {{ message }}
        </p>
        <p class="mt-6 text-base leading-7 text-zinc-400">
          An error occurred while responding to your request. If you believe
          this to be a bug, please report it. Try signing in and see if it
          resolves the issue.
        </p>
        <div class="mt-10">
          <!-- full app reload to fix errors -->
          <NuxtLink
            v-if="user && !showSignIn"
            to="/"
            class="text-sm font-semibold leading-7 text-blue-600"
            ><span aria-hidden="true">&larr;</span> Back to home</NuxtLink
          >
          <button
            v-else
            class="text-sm font-semibold leading-7 text-blue-600"
            @click="signIn"
          >
            Sign in <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </div>
    </main>
    <footer class="self-end lg:col-span-2 lg:col-start-1 lg:row-start-3">
      <div class="border-t border-zinc-700 bg-zinc-900 py-10">
        <nav
          class="mx-auto flex w-full max-w-7xl items-center gap-x-4 px-6 text-sm leading-7 text-zinc-400 lg:px-8"
        >
          <NuxtLink href="/docs">Documentation</NuxtLink>
          <svg
            viewBox="0 0 2 2"
            aria-hidden="true"
            class="h-0.5 w-0.5 fill-zinc-600"
          >
            <circle cx="1" cy="1" r="1" />
          </svg>
          <NuxtLink to="https://discord.gg/NHx46XKJWA" target="_blank">
            Support Discord
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
      >
    </div>
  </div>
</template>
