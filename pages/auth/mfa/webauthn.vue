<template>
  <div class="flex flex-col items-center">
    <div v-if="success">
      <CheckIcon class="w-8 h-8 text-green-600" />
    </div>
    <div v-else-if="loading">
      <svg
        aria-hidden="true"
        class="w-8 h-8 text-transparent animate-spin fill-blue-600"
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
    </div>

    <div v-else class="inline-flex gap-x-2">
      <LoadingButton :loading="false" @click="() => tryAuthWrapper()">
        Sign in with WebAuthn</LoadingButton
      >
    </div>

    <div v-if="error" class="mt-8 rounded-md bg-red-600/10 p-4">
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
</template>

<script setup lang="ts">
import { startAuthentication } from "@simplewebauthn/browser";
import type { FetchError } from "ofetch";

const loading = ref<boolean>(false);
const success = ref(false);
const error = ref<undefined | string>(undefined);

async function tryAuth() {
  const optionsJSON = await $dropFetch("/api/v1/auth/mfa/webauthn/start", {
    method: "POST",
  });

  let asseResp;
  try {
    asseResp = await startAuthentication({ optionsJSON });
  } catch {
    throw createError({
      statusCode: 400,
      message: "Passkey sign-in cancelled.",
    });
  }
  if (!asseResp)
    throw createError({
      statusCode: 400,
      message: "Passkey sign-in cancelled.",
    });

  await $dropFetch("/api/v1/auth/mfa/webauthn/finish", {
    method: "POST",
    body: asseResp,
  });

  await completeSignin();
}

async function tryAuthWrapper() {
  loading.value = true;
  try {
    await tryAuth();
    success.value = true;
  } catch (e) {
    error.value = (e as FetchError)?.data?.message ?? e;
  }
  loading.value = false;
}
</script>
