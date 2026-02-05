<template>
  <div
    class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <KeyIcon class="text-blue-600 mx-auto h-10 w-auto" />
      <h2
        class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white"
      >
        {{ $t("auth.2fa.passkey.createTitle") }}
      </h2>
      <p class="text-sm text-center text-zinc-400">
        {{ $t("auth.2fa.passkey.createDescription") }}
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form
        class="space-y-6"
        action="#"
        method="POST"
        @submit.prevent="attemptPasskeyWrapper"
      >
        <div>
          <label for="name" class="block text-sm/6 font-medium text-gray-100">{{
            $t("auth.2fa.passkey.passkeyNameTag")
          }}</label>
          <div class="mt-2">
            <input
              id="name"
              v-model="name"
              type="text"
              name="name"
              required
              placeholder="My New Passkey"
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6"
            />
          </div>
        </div>

        <div>
          <LoadingButton :disabled="disabled" :loading="loading" class="w-full">
            {{ $t("common.create") }}
          </LoadingButton>
        </div>

        <div
          v-if="error"
          class="mt-4 rounded-md bg-red-600/10 p-4 max-w-sm mx-auto"
        >
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyIcon, XCircleIcon } from "@heroicons/vue/24/outline";
import type { FetchError } from "ofetch";
import { startRegistration } from "@simplewebauthn/browser";

const router = useRouter();

const name = ref("");
const disabled = computed(() => !name.value);
const loading = ref(false);
const error = ref<string | undefined>();

useHead({
  title: "Create a passkey",
});

async function attemptPasskeyWrapper() {
  loading.value = true;
  try {
    await attemptPasskey();
  } catch (e) {
    console.error(e);
    error.value = (e as FetchError)?.data?.message ?? e;
  }
  loading.value = false;
}

async function attemptPasskey() {
  if (!window.PublicKeyCredential)
    throw createError({
      statusCode: 400,
      message: "Browser does not support WebAuthn",
      fatal: true,
    });

  const optionsJSON = await $dropFetch("/api/v1/user/mfa/webauthn/start", {
    method: "POST",
    body: {
      name: name.value,
    },
  });

  let attResp;
  try {
    // Pass the options to the authenticator and wait for a response
    attResp = await startRegistration({ optionsJSON });
  } catch {
    throw createError({
      statusCode: 400,
      message: "WebAuthn request cancelled.",
    });
  }
  if (!attResp)
    throw createError({
      statusCode: 400,
      message: "WebAuthn request cancelled.",
    });

  await $dropFetch("/api/v1/user/mfa/webauthn/finish", {
    method: "POST",
    body: attResp,
  });

  router.push("/mfa/setup/successful");
}
</script>
