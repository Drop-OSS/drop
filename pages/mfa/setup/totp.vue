<template>
  <main
    class="mx-auto grid lg:grid-cols-2 max-w-md lg:max-w-none min-h-full place-items-center w-full gap-4 px-6 py-12 sm:py-32 lg:px-8"
  >
    <div>
      <div class="text-left max-w-md">
        <h1
          class="mt-4 text-3xl font-bold font-display tracking-tight text-zinc-100 sm:text-5xl"
        >
          {{ $t("auth.2fa.totp.createTitle") }}
        </h1>
        <p class="mt-6 text-base leading-7 text-zinc-400">
          {{ $t("auth.2fa.totp.createDescription") }}
        </p>
        <div class="mt-8">
          <p class="text-xs leading-7 text-zinc-200">
            {{ $t("auth.2fa.totp.createHint") }}
          </p>
          <div class="mt-2 flex flex-row gap-2">
            <CodeInput
              :length="6"
              placeholder="123456"
              size="w-10 h-10 text-sm"
              @complete="(code) => complete(code)"
            />
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
        </div>
      </div>
    </div>
    <div>
      <div class="max-w-2xl flex flex-col items-center gap-2">
        <div id="qrcode" />
        <p
          class="font-bold font-display text-zinc-500 uppercase font-sm tracking-tight"
        >
          {{ totpSecrets?.secret }}
        </p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { FetchError } from "ofetch";

useHead({
  title: "Set up TOTP",
});

const totpSecrets = await $dropFetch("/api/v1/user/mfa/totp/start", {
  method: "POST",
});

const error = ref<string | undefined>();
const router = useRouter();

onMounted(async () => {
  const kjua = await import("kjua");
  const el = kjua.default({ text: totpSecrets.url, render: "svg", size: 400 });
  document.querySelector("#qrcode")?.appendChild(el);
});

async function complete(code: string) {
  try {
    await $dropFetch("/api/v1/user/mfa/totp/finish", {
      method: "POST",
      body: { code },
    });
    router.push("/mfa/setup/successful");
  } catch (e) {
    error.value =
      (e as FetchError).data?.message ?? (e as FetchError).statusMessage;
  }
}
</script>
