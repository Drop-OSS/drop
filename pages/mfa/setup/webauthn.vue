<template>
  <div
    class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <KeyIcon class="text-blue-600 mx-auto h-10 w-auto" />
      <h2
        class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white"
      >
        Create a passkey
      </h2>
      <p class="text-sm text-center text-zinc-400">
        WebAuthn, or passkeys, allow you to sign in or complete 2FA with
        biometrics or hardware security devices.
      </p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form
        @submit.prevent="attemptPasskeyWrapper"
        class="space-y-6"
        action="#"
        method="POST"
      >
        <div>
          <label for="name" class="block text-sm/6 font-medium text-gray-100"
            >Name</label
          >
          <div class="mt-2">
            <input
              type="text"
              name="name"
              id="name"
              required
              placeholder="My New Passkey"
              class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-500 sm:text-sm/6"
              v-model="name"
            />
          </div>
        </div>

        <div>
          <LoadingButton :disabled="disabled" :loading="loading" class="w-full">
            Create
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
import { KeyIcon } from "@heroicons/vue/24/outline";
import { FetchError } from "ofetch";

const { challenge, rp, user } = await $dropFetch(
  "/api/v1/user/mfa/webauthn/start",
  {
    method: "POST",
  },
);

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

  const encoder = new TextEncoder();
  const publicKey = {
    challenge: encoder.encode(challenge),
    rp,
    user: {
      id: encoder.encode(user.userId),
      displayName: user.displayName,
      name: user.username,
    },
    pubKeyCredParams: [
      {
        type: "public-key",
        alg: -8, // "EdDSA" as registered in the IANA COSE Algorithms registry
      },
      {
        type: "public-key",
        alg: -7, // "ES256" as registered in the IANA COSE Algorithms registry
      },
      {
        type: "public-key",
        alg: -257, // Value registered by this specification for "RS256"
      },
    ],
  } satisfies CredentialCreationOptions["publicKey"];

  let cred: Credential | null;
  try {
    cred = await navigator.credentials.create({ publicKey });
  } catch {
    throw createError({
      statusCode: 400,
      message: "WebAuthn request cancelled.",
    });
  }
  if (!cred)
    throw createError({
      statusCode: 400,
      message: "WebAuthn request cancelled.",
    });

  const response = (cred as PublicKeyCredential)
    .response as AuthenticatorAttestationResponse;

  await $dropFetch("/api/v1/user/mfa/webauthn/finish", {
    method: "POST",
    body: {
      name: name.value,
      clientData: btoa(
        String.fromCharCode(...new Uint8Array(response.clientDataJSON)),
      ),
      attestationObject: btoa(
        String.fromCharCode(...new Uint8Array(response.attestationObject)),
      ),
    },
  });

  router.push("/account/security");
}
</script>
