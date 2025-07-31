<template>
  <div class="p-2 lg:p-4">
    <div class="px-4 py-2 max-w-xl">
      <h1 class="font-semibold text-zinc-100 text-xl">
        {{ $t("setup.auth.title") }}
      </h1>
      <p class="mt-2 text-sm text-zinc-400">
        {{ $t("setup.auth.description") }}
      </p>
    </div>
    <div class="grid lg:grid-cols-2 xl:grid-cols-3 h-fit p-4 gap-4">
      <div class="p-4 border-1 border-zinc-800 rounded-xl">
        <div>
          <h1 class="text-zinc-100 font-semibold text-lg">
            {{ $t("setup.auth.simple.title") }}
          </h1>
          <p class="text-sm text-zinc-400">
            {{ $t("setup.auth.simple.description") }}
          </p>
          <NuxtLink
            class="mt-4 rounded-md inline-flex items-center text-sm font-semibold text-blue-500 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            href="https://docs.droposs.org/docs/authentication/simple"
            target="_blank"
          >
            <i18n-t
              keypath="setup.auth.docs"
              tag="span"
              class="inline-flex items-center gap-x-1"
              scope="global"
            >
              <template #arrow>
                <ArrowTopRightOnSquareIcon class="size-4" />
              </template>
            </i18n-t>
          </NuxtLink>
        </div>
        <div class="mt-4">
          <div class="w-full flex justify-between items-center">
            <span class="text-zinc-100 font-semibold text-sm">{{
              $t("setup.auth.enabled")
            }}</span>
            <CheckIcon
              v-if="enabledAuth.Simple"
              class="size-5 text-green-600"
            />
            <XMarkIcon v-else class="size-5 text-red-600" />
          </div>
          <LoadingButton
            class="mt-4"
            :loading="invitationLoading"
            :disabled="!enabledAuth.Simple"
            @click="() => registerAsAdmin()"
          >
            <i18n-t
              keypath="setup.auth.simple.register"
              tag="span"
              class="inline-flex items-center gap-x-1"
              scope="global"
            >
              <template #arrow>
                {{ $t("chars.arrow") }}
              </template>
            </i18n-t>
          </LoadingButton>
        </div>
      </div>
      <div class="p-4 border-1 border-zinc-800 rounded-xl">
        <div>
          <h1 class="text-zinc-100 font-semibold text-lg">
            {{ $t("setup.auth.openid.title") }}
          </h1>
          <p class="text-sm text-zinc-400">
            {{ $t("setup.auth.openid.description") }}
          </p>
          <NuxtLink
            class="mt-4 rounded-md inline-flex items-center text-sm font-semibold text-blue-500 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            href="https://docs.droposs.org/docs/authentication/oidc"
            target="_blank"
          >
            <i18n-t
              keypath="setup.auth.docs"
              tag="span"
              class="inline-flex items-center gap-x-1"
              scope="global"
            >
              <template #arrow>
                <ArrowTopRightOnSquareIcon class="size-4" />
              </template>
            </i18n-t>
          </NuxtLink>
        </div>
        <div class="mt-4">
          <div class="w-full flex justify-between items-center">
            <span class="text-zinc-100 font-semibold text-sm">{{
              $t("setup.auth.enabled")
            }}</span>
            <CheckIcon
              v-if="enabledAuth.OpenID"
              class="size-5 text-green-600"
            />
            <XMarkIcon v-else class="size-5 text-red-600" />
          </div>
          <LoadingButton
            class="mt-4"
            :loading="false"
            :disabled="!enabledAuth.OpenID"
            @click="() => (complete = true)"
          >
            <i18n-t
              keypath="setup.auth.openid.skip"
              tag="span"
              class="inline-flex items-center gap-x-1"
              scope="global"
            >
              <template #arrow>
                {{ $t("chars.arrow") }}
              </template>
            </i18n-t>
          </LoadingButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import { DateTime } from "luxon";

const complete = defineModel<boolean>({ required: true });

const { token } = defineProps<{ token: string }>();

const invitationLoading = ref(false);

const enabledAuth = await $dropFetch("/api/v1/admin/auth", {
  headers: { Authorization: token },
});

async function registerAsAdmin() {
  invitationLoading.value = true;
  const expiryDate = DateTime.now().plus({ year: 5000 }).toJSON();

  const invitation = await $dropFetch("/api/v1/admin/auth/invitation", {
    method: "POST",
    body: { isAdmin: true, expires: expiryDate },
    headers: { Authorization: token },
    failTitle: "Failed to create admin invitation",
  });

  window.open(`${invitation.inviteUrl}&after=close`, "_blank")?.focus();
  invitationLoading.value = false;
  complete.value = true;
}
</script>
