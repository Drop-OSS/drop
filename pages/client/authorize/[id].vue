<template>
  <div
    v-if="completed"
    class="min-h-full w-full flex items-center justify-center py-10"
  >
    <div class="flex flex-col items-center">
      <CheckCircleIcon class="h-12 w-12 text-green-600" aria-hidden="true" />
      <div class="mt-3 text-center sm:mt-5">
        <h1 class="text-3xl font-semibold font-display leading-6 text-zinc-100">
          {{ $t("auth.callback.success") }}
        </h1>
        <div class="mt-4">
          <p class="mx-auto text-sm text-zinc-400 max-w-sm">
            {{ $t("auth.callback.authorizedClient") }}
          </p>

          <Disclosure v-if="authToken" v-slot="{ open }" as="div" class="mt-8">
            <dt>
              <DisclosureButton
                class="pb-2 flex w-full items-start justify-between text-left text-zinc-400"
              >
                <span class="text-sm font-semibold">
                  {{ $t("auth.callback.issues") }}
                </span>
                <span class="ml-6 flex h-7 items-center">
                  <ChevronUpIcon
                    v-if="!open"
                    class="size-4"
                    aria-hidden="true"
                  />
                  <ChevronDownIcon v-else class="size-4" aria-hidden="true" />
                </span>
              </DisclosureButton>
            </dt>
            <DisclosurePanel as="dd" class="mt-2">
              <p class="text-zinc-100 font-semibold text-sm mb-3">
                {{ $t("auth.callback.paste") }}
              </p>
              <p
                class="max-w-sm text-nowrap overflow-x-auto text-sm bg-zinc-950/50 p-3 text-zinc-300 w-fit mx-auto rounded-xl"
              >
                {{ authToken }}
              </p>
            </DisclosurePanel>
          </Disclosure>
        </div>
      </div>
    </div>
  </div>
  <main
    v-else-if="clientData"
    class="mx-auto grid lg:grid-cols-2 max-w-md lg:max-w-none min-h-full place-items-center w-full gap-4 px-6 py-12 sm:py-32 lg:px-8"
  >
    <div>
      <div class="text-left">
        <h1
          class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl"
        >
          {{ $t("auth.callback.authClient") }}
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-400">
          {{ $t("auth.callback.requestedAccess", { name: clientData.name }) }}
        </p>
        <div
          action="/api/v1/client/callback"
          method="post"
          class="mt-10 gap-x-6"
        >
          <input type="text" class="hidden" name="id" :value="clientId" />
          <button
            class="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="() => authorize_wrapper()"
          >
            {{ $t("auth.callback.authorize") }}
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
          {{
            $t("auth.callback.permWarning", {
              name: clientData.name,
              platform: clientData.platform,
            })
          }}
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
                >
                  <i18n-t
                    keypath="auth.callback.learn"
                    tag="span"
                    scope="global"
                  >
                    <template #arrow>
                      <span aria-hidden="true">{{ $t("chars.arrow") }}</span>
                    </template>
                  </i18n-t>
                </NuxtLink>
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
import {
  ArrowDownTrayIcon,
  UserGroupIcon,
  XCircleIcon,
} from "@heroicons/vue/16/solid";
import { LockClosedIcon } from "@heroicons/vue/20/solid";
import { CheckCircleIcon, CloudIcon } from "@heroicons/vue/24/outline";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import type { FetchError } from "ofetch";

const route = useRoute();
const clientId = route.params.id;

const clientData = await $dropFetch(`/api/v1/client/auth?id=${clientId}`);

const completed = ref(false);
const error = ref();
const authToken = ref<string | undefined>();

async function authorize() {
  switch (clientData.mode) {
    case "callback": {
      const { redirect, token } = await $dropFetch(
        `/api/v1/client/auth/callback`,
        {
          method: "POST",
          body: { id: clientId },
        },
      );
      authToken.value = token;
      window.location.replace(redirect);
      return;
    }
    case "code": {
      await $dropFetch("/api/v1/client/auth/code", {
        method: "POST",
        body: { id: clientId },
      });
      return;
    }
  }
  throw createError({
    statusCode: 500,
    message: "Unknown client auth mode: " + clientData.mode,
    fatal: true,
  });
}

async function authorize_wrapper() {
  try {
    await authorize();
  } catch (e) {
    const errorMessage =
      (e as FetchError)?.message || "An unknown error occurred.";
    error.value = errorMessage;
  } finally {
    completed.value = true;
  }
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
    name: "Update your status",
    description:
      "The client will be able to update your status, and affect your playtime.",
    href: "/docs/access/status",
    icon: UserGroupIcon,
  },
  clientData.capabilities["peerAPI"] && {
    name: "Access the Drop network",
    description:
      "The client will be able to establish P2P connections with other users to enable features like download aggregation, Remote LAN play and P2P multiplayer.",
    href: "/docs/access/network",
    icon: LockClosedIcon,
  },
  clientData.capabilities["cloudSaves"] && {
    name: "Upload and sync cloud saves",
    description:
      "The client will be able to upload new cloud saves, and edit your existing ones.",
    href: "/docs/access/cloud",
    icon: CloudIcon,
  },
].filter((e) => e !== undefined);

useHead({
  title: "Authorize",
});
</script>
