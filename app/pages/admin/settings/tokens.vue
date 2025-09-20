<template>
  <div class="w-full">
    <div class="w-full flex justify-between items-center">
      <div>
        <h2
          class="mt-2 text-xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
        >
          {{ $t("account.token.title") }}
        </h2>
        <p
          class="mt-2 text-pretty text-sm font-medium text-zinc-400 sm:text-md/8"
        >
          {{ $t("account.token.subheader") }}
        </p>
      </div>
      <div>
        <LoadingButton :loading="false" @click="() => (createOpen = true)">
          {{ $t("common.create") }}
        </LoadingButton>
      </div>
    </div>

    <div
      v-if="newToken"
      class="mt-4 rounded-md p-4 bg-green-500/10 outline outline-green-500/20"
    >
      <div class="flex">
        <div class="shrink-0">
          <CheckCircleIcon class="size-5 text-green-400" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-green-300">
            {{ $t("account.token.success") }}
          </p>
          <p class="text-xs text-green-300/70">
            {{ $t("account.token.successNote") }}
          </p>
          <p
            class="mt-2 bg-zinc-950 px-3 py-2 font-mono text-zinc-400 rounded-xl"
          >
            {{ newToken }}
          </p>
        </div>
        <div class="ml-auto pl-3">
          <div class="-mx-1.5 -my-1.5">
            <button
              type="button"
              class="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-green-50 focus-visible:outline-hidden dark:bg-transparent dark:text-green-400 dark:hover:bg-green-500/10 dark:focus-visible:ring-green-500 dark:focus-visible:ring-offset-1 dark:focus-visible:ring-offset-green-900"
              @click="() => (newToken = undefined)"
            >
              <span class="sr-only">{{ $t("common.close") }}</span>
              <XMarkIcon class="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-zinc-800">
          <thead>
            <tr class="bg-zinc-800/50">
              <th
                scope="col"
                class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-6"
              >
                {{ $t("common.name") }}
              </th>
              <th
                scope="col"
                class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
              >
                {{ $t("account.token.acls") }}
              </th>
              <th
                scope="col"
                class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
              >
                {{ $t("account.token.expiry") }}
              </th>
              <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span class="sr-only">{{ $t("actions") }}</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr
              v-for="(token, tokenIdx) in tokens"
              :key="token.id"
              class="transition-colors duration-150 hover:bg-zinc-800/50"
            >
              <td
                class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-6"
              >
                {{ token.name }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="acl in token.acls"
                    :key="acl"
                    class="inline-flex items-center gap-x-1 rounded-md bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-400/20"
                  >
                    {{ acl }}
                  </span>
                </div>
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
                <RelativeTime v-if="token.expiresAt" :date="token.expiresAt" />
                <span v-else>{{ $t("account.token.noExpiry") }}</span>
              </td>
              <td
                class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"
              >
                <button
                  class="inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20 transition-all duration-200 hover:bg-red-400/20 hover:scale-105 active:scale-95"
                  @click="() => revokeToken(tokenIdx)"
                >
                  {{ $t("account.token.revoke") }}
                  <span class="sr-only">
                    {{ $t("chars.srComma", [token.name]) }}
                  </span>
                </button>
              </td>
            </tr>
            <tr v-if="tokens.length === 0">
              <td colspan="5" class="py-8 text-center text-sm text-zinc-400">
                {{ $t("account.token.noTokens") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ModalCreateToken
      v-model="createOpen"
      :acls="acls"
      :loading="createLoading"
      :suggested-name="suggestedName"
      :suggested-acls="suggestedAcls"
      @create="(name, acls, expiry) => createToken(name, acls, expiry)"
    />
  </div>
</template>

<script setup lang="ts">
import { ArkErrors, type } from "arktype";
import { DateTime, type DurationLike } from "luxon";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/vue/20/solid";

definePageMeta({
  layout: "admin",
});

const tokens = ref(await $dropFetch("/api/v1/admin/token"));
const acls = await $dropFetch("/api/v1/admin/token/acls");

const createOpen = ref(false);
const createLoading = ref(false);

const newToken = ref<string | undefined>();

const suggestedName = ref();
const suggestedAcls = ref<string[]>([]);

const payloadParser = type({
  name: "string?",
  acls: "string[]?",
});

const route = useRoute();
if (route.query.payload) {
  try {
    const rawPayload = JSON.parse(atob(route.query.payload.toString()));
    const payload = payloadParser(rawPayload);
    if (payload instanceof ArkErrors) throw payload;
    suggestedName.value = payload.name;
    suggestedAcls.value = payload.acls ?? [];
    createOpen.value = true;
  } catch {
    throw createError({
      statusCode: 400,
      message: "Failed to parse the token create payload.",
      fatal: true,
    });
  }
}

async function createToken(
  name: string,
  acls: string[],
  expiry: DurationLike | undefined,
) {
  createLoading.value = true;
  try {
    const result = await $dropFetch("/api/v1/admin/token", {
      method: "POST",
      body: {
        name,
        acls,
        expiry: expiry ? DateTime.now().plus(expiry) : undefined,
      },
      failTitle: "Failed to create API token.",
    });
    console.log(result);
    newToken.value = result.token;
    tokens.value.push(result);
  } catch {
    /* empty */
  }
  createOpen.value = false;
  createLoading.value = false;
}

async function revokeToken(index: number) {
  const token = tokens.value[index];
  if (!token) return;

  await $dropFetch("/api/v1/admin/token/:id", {
    method: "DELETE",
    params: {
      id: token.id,
    },
    failTitle: "Failed to revoke token.",
  });

  tokens.value.splice(index, 1);
}
</script>
