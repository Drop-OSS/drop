<template>
  <div
    class="min-h-full w-full flex items-center justify-center"
    v-if="completed"
  >
    <div class="flex flex-col items-center">
      <CheckCircleIcon class="h-12 w-12 text-green-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          Successful!
        </h1>
        <div class="mt-4">
          <p class="text-sm text-zinc-400 max-w-sm">
            Drop has successfully authorized the client. You may now close this
            window.
          </p>
        </div>
      </div>
    </div>
  </div>
  <main
    v-else-if="clientData.data.value"
    class="mx-auto grid lg:grid-cols-2 max-w-md lg:max-w-none min-h-full place-items-center w-full gap-4 px-6 py-12 sm:py-32 lg:px-8"
  >
    <div>
      <div class="text-left">
        <h1
          class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl"
        >
          Authorize client?
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-400">
          "{{ clientData.data.value.name }}" has requested access to your Drop
          account.
        </p>
        <div
          action="/api/v1/client/callback"
          method="post"
          class="mt-10 gap-x-6"
        >
          <input type="text" class="hidden" name="id" :value="clientId" />
          <button
            @click="() => authorize_wrapper()"
            class="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Authorize
          </button>

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
    </div>
    <div>
      <div class="max-w-2xl">
        <p
          class="mt-6 font-semibold font-display text-lg leading-8 text-zinc-100"
        >
          Accepting this request will allow "{{ clientData.data.value.name }}"
          on "{{ clientData.data.value.platform }}" to:
        </p>
      </div>
      <div class="mt-8 max-w-2xl sm:mt-12 lg:mt-14">
        <dl class="flex flex-col gap-x-8 gap-y-8">
          <div
            v-for="feature in scopes"
            :key="feature.name"
            class="flex flex-col"
          >
            <dt
              class="flex items-center gap-x-3 text-base font-semibold font-display leading-7 text-zinc-100"
            >
              <component
                :is="feature.icon"
                class="h-5 w-5 flex-none text-blue-600"
                aria-hidden="true"
              />
              {{ feature.name }}
            </dt>
            <dd
              class="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-400"
            >
              <p class="flex-auto">{{ feature.description }}</p>
              <p class="mt-1">
                <NuxtLink
                  :href="feature.href"
                  class="text-sm font-semibold leading-6 text-blue-600"
                  >Learn more <span aria-hidden="true">→</span></NuxtLink
                >
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </main>
  <main
    v-else-if="clientData.error.value != undefined"
    class="grid min-h-full w-full place-items-center px-6 py-24 sm:py-32 lg:px-8"
  >
    <div class="text-center">
      <p class="text-base font-semibold text-blue-600">400</p>
      <h1
        class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl"
      >
        Invalid or expired request
      </h1>
      <p class="mt-6 text-base leading-7 text-zinc-400">
        Unfortunately, we couldn't load the authorization request.
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import {
  ArrowDownTrayIcon,
  UserGroupIcon,
  XCircleIcon,
} from "@heroicons/vue/16/solid";
import { LockClosedIcon } from "@heroicons/vue/20/solid";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";

const route = useRoute();
const clientId = route.params.id;

const clientData = await useFetch(`/api/v1/client/auth/callback?id=${clientId}`);

const completed = ref(false);
const error = ref();

async function authorize() {
  const redirect = await $fetch<string>("/api/v1/client/auth/callback", {
    method: "POST",
    body: { id: clientId },
  });
  window.location.replace(redirect);
}

function authorize_wrapper() {
  authorize()
    .catch((e) => {
      const errorMessage = e.statusMessage || "An unknown error occurred.";
      error.value = errorMessage;
    })
    .then(() => {
      completed.value = true;
    });
}

const scopes = [
  {
    name: "Access game content and saves",
    description:
      "The client will be able to download games, sync saves and access game content, like screenshots and mods.",
    href: "/docs/access/content",
    icon: ArrowDownTrayIcon,
  },
  {
    name: "Access the Drop network",
    description:
      "The client will be able to establish P2P connections with other users to enable features like download aggregation, Remote LAN play and P2P multiplayer.",
    href: "/docs/access/network",
    icon: LockClosedIcon,
  },
  {
    name: "Manage your account",
    description:
      "The client will be able to change your account details, and friend statuses on your behalf.",
    href: "/docs/access/account",
    icon: UserGroupIcon,
  },
];

useHead({
  title: "Authorize",
});
</script>
