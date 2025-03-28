<template>
  <div class="flex min-h-screen flex-1 bg-zinc-900">
    <div
      class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24"
    >
      <div class="mx-auto w-full max-w-sm lg:w-96">
        <div>
          <Logo class="h-10 w-auto" />
          <h2
            class="mt-8 text-2xl font-bold font-display leading-9 tracking-tight text-zinc-100"
          >
            Sign in to your account
          </h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Don't have an account? Ask an admin to create one for you.
          </p>
        </div>

        <div class="mt-10">
          <div>
            <form @submit.prevent="signin_wrapper" class="space-y-6">
              <div>
                <label
                  for="username"
                  class="block text-sm font-medium leading-6 text-zinc-300"
                  >Username</label
                >
                <div class="mt-2">
                  <input
                    id="username"
                    name="username"
                    type="username"
                    autocomplete="username"
                    required
                    class="block w-full rounded-md border-0 py-1.5 px-3 shadow-sm bg-zinc-950/20 text-zinc-300 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    v-model="username"
                  />
                </div>
              </div>

              <div>
                <label
                  for="password"
                  class="block text-sm font-medium leading-6 text-zinc-300"
                  >Password</label
                >
                <div class="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    v-model="password"
                    required
                    class="block w-full rounded-md border-0 py-1.5 px-3 shadow-sm bg-zinc-950/20 text-zinc-300 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    v-model="rememberMe"
                    class="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-blue-600"
                  />
                  <label
                    for="remember-me"
                    class="ml-3 block text-sm leading-6 text-zinc-400"
                    >Remember me</label
                  >
                </div>

                <div class="text-sm leading-6">
                  <a
                    href="#"
                    class="font-semibold text-blue-600 hover:text-blue-500"
                    >Forgot password?</a
                  >
                </div>
              </div>

              <div>
                <LoadingButton class="w-full" :loading="loading">
                  Sign in</LoadingButton
                >
              </div>

              <div v-if="error" class="mt-1 rounded-md bg-red-600/10 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <XCircleIcon
                      class="h-5 w-5 text-red-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-600">
                      {{ error }}
                    </h3>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
    <div class="relative hidden w-0 flex-1 lg:block">
      <NuxtImg
        src="/wallpapers/signin.jpg"
        class="absolute inset-0 h-full w-full object-cover"
        alt=""
        width="3000"
        height="3000"
        provider="ipx"
        quality="80"
        :placeholder="[700, 700, 75, 5]"
        preload
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/20/solid";
import type { User } from "@prisma/client";
import Logo from "~/components/Logo.vue";

const username = ref("");
const password = ref("");
const rememberMe = ref(false);
const loading = ref(false);

const route = useRoute();
const router = useRouter();

const error = ref<string | undefined>();

function signin_wrapper() {
  loading.value = true;
  signin()
    .then(() => {
      router.push(route.query.redirect?.toString() ?? "/");
    })
    .catch((response) => {
      const message = response.statusMessage || "An unknown error occurred";
      error.value = message;
    })
    .finally(() => {
      loading.value = false;
    });
}

async function signin() {
  await $dropFetch("/api/v1/auth/signin/simple", {
    method: "POST",
    body: {
      username: username.value,
      password: password.value,
      rememberMe: rememberMe.value,
    },
  });
  const user = useUser();
  user.value = await $dropFetch<User | null>("/api/v1/user");
}

definePageMeta({
  layout: false,
});

useHead({
  title: "Sign in to Drop",
});
</script>
