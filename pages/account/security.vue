<template>
  <div>
    <div
      v-if="!superlevel"
      class="border-l-4 p-4 border-yellow-500 bg-yellow-500/10"
    >
      <div class="flex">
        <div class="shrink-0">
          <ExclamationTriangleIcon
            class="size-5 text-yellow-500"
            aria-hidden="true"
          />
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-300">
            Sign in again to access these settings.
            {{ " " }}
            <NuxtLink
              href="/auth/signin?redirect=/account/security&superlevel=true"
              class="font-medium underline text-yellow-300 hover:text-yellow-200"
              >Sign in &rarr;</NuxtLink
            >
          </p>
        </div>
      </div>
    </div>
    <div v-else class="border-l-4 p-4 border-green-500 bg-green-500/10">
      <div class="flex">
        <div class="shrink-0">
          <CheckCircleIcon class="size-5 text-green-500" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <p class="text-sm text-green-300">
            You have access to these protected actions.
          </p>
        </div>
      </div>
    </div>
    <div class="mt-6 relative">
      <div></div>
      <div class="mt-8 border-b border-white/10 pb-2">
        <h3 class="text-base font-semibold text-white">
          Two-factor authentication
        </h3>
      </div>
      <div class="mt-4 flex flex-wrap gap-8">
        <!-- TOTP -->
        <div
          class="group relative border-white/10 bg-zinc-800/50 p-6 rounded-md"
        >
          <div>
            <span
              class="inline-flex rounded-lg p-3 bg-blue-400/10 text-blue-400"
            >
              <ClockIcon class="size-6" aria-hidden="true" />
            </span>
          </div>
          <div class="mt-8 max-w-sm">
            <h3 class="text-base font-semibold text-white">
              <NuxtLink
                :href="mfa.mecs.TOTP?.enabled ? '' : '/mfa/setup/totp'"
                class="focus:outline-hidden"
              >
                <!-- Extend touch target to entire panel -->
                <span
                  v-if="!mfa.mecs.TOTP?.enabled"
                  class="absolute inset-0"
                  aria-hidden="true"
                ></span>
                TOTP
              </NuxtLink>
            </h3>
            <p class="mt-2 text-sm text-gray-400">
              TOTP generates one-time codes, completely offline. You can use any
              TOTP authenticator you like.
            </p>
            <div v-if="mfa.mecs.TOTP?.enabled" class="mt-3">
              <LoadingButton :loading="false">Disable</LoadingButton>
            </div>
          </div>
          <span
            class="pointer-events-none absolute top-6 right-6"
            aria-hidden="true"
          >
            <svg
              v-if="!mfa.mecs.TOTP?.enabled"
              class="size-6 text-gray-500 group-hover:text-gray-200"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z"
              />
            </svg>
            <CheckIcon v-else class="size-6 text-green-600" />
          </span>
        </div>
        <!-- WebAuthn -->
        <div
          class="group relative border-white/10 bg-zinc-800/50 p-6 rounded-md"
        >
          <div>
            <span
              class="inline-flex rounded-lg p-3 bg-blue-400/10 text-blue-400"
            >
              <KeyIcon class="size-6" aria-hidden="true" />
            </span>
          </div>
          <div class="mt-8 max-w-sm">
            <h3 class="text-base font-semibold text-white">WebAuthn</h3>
            <p class="mt-2 text-sm text-gray-400">
              Otherwise known as passkeys. Authenticate using biometrics, a
              device, YubiKeys, or any compatible FIDO2 device.
            </p>
            <p class="mt-1 text-xs font-bold text-zinc-300">
              Also lets you bypass signing in with compatible devices.
            </p>
          </div>
          <LoadingButton
            class="mt-3"
            :loading="false"
            @click="() => (webAuthnOpen = true)"
            >Manage</LoadingButton
          >
        </div>
      </div>
      <div v-if="!superlevel" class="absolute inset-0 bg-zinc-900/50" />
    </div>
    <ModalTemplate v-model="webAuthnOpen" size-class="max-w-2xl">
      <template #default>
        <div class="sm:flex sm:items-center">
          <div class="sm:flex-auto">
            <h1 class="text-base font-semibold text-white">WebAuthn Keys</h1>
            <p class="mt-2 text-sm text-gray-300">
              Create new keys or remove existing keys from your account.
            </p>
          </div>
          <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <NuxtLink
              to="/mfa/setup/webauthn"
              class="block rounded-md bg-blue-500 px-3 py-2 text-center text-sm font-semibold text-white shadow-xs hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              New key
            </NuxtLink>
          </div>
        </div>
        <div class="mt-8 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div
              class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
            >
              <table class="relative min-w-full divide-y divide-white/15">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-white sm:pl-0"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      class="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-white sm:pl-0"
                    >
                      Created
                    </th>

                    <th scope="col" class="py-3.5 pr-4 pl-3 sm:pr-0">
                      <span class="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10">
                  <tr
                    v-for="mec in (mfa.mecs.WebAuthn?.credentials as Array<{
                      id: string;
                      name: string;
                      created: number;
                    }>) ?? []"
                    :key="mec.id"
                  >
                    <td
                      class="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-white sm:pl-0"
                    >
                      {{ mec.name }}
                    </td>
                    <td
                      class="py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap text-white sm:pl-0"
                    >
                      <RelativeTime :date="new Date(mec.created)" />
                    </td>

                    <td
                      class="py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-0"
                    >
                      <a href="#" class="text-blue-400 hover:text-blue-300"
                        >Delete</a
                      >
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
      <template #buttons>
        <button
          ref="cancelButtonRef"
          type="button"
          class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 sm:mt-0 sm:w-auto"
          @click="webAuthnOpen = false"
        >
          {{ $t("common.close") }}
        </button>
      </template>
    </ModalTemplate>
  </div>
</template>

<script setup lang="ts">
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/vue/20/solid";
import { CheckIcon, ClockIcon, KeyIcon } from "@heroicons/vue/24/outline";
const superlevel = await $dropFetch("/api/v1/user/superlevel");
//const auth = await $dropFetch("/api/v1/user/auth");
const mfa = await $dropFetch("/api/v1/user/mfa");

const webAuthnOpen = ref(false);
</script>
