<template>
  <ul
    role="list"
    class="-mt-6 divide-y divide-white/10 border-b border-white/10"
  >
    <li v-if="mfa.includes(MFAMec.TOTP)" class="relative flex gap-x-6 py-6">
      <div
        class="flex size-10 flex-none items-center justify-center rounded-lg bg-zinc-800/50 shadow-xs outline-1 -outline-offset-1 outline-white/10"
      >
        <ClockIcon class="size-6 text-blue-400" aria-hidden="true" />
      </div>
      <div class="flex-auto">
        <h3 class="text-sm/6 font-semibold text-white">
          <NuxtLink :to="{ path: '/auth/mfa/totp', query: route.query }">
            <span class="absolute inset-0" aria-hidden="true"></span>
            TOTP
          </NuxtLink>
        </h3>
        <p class="mt-2 text-sm/6 text-zinc-400">
          Use a one-time code to sign in to your Drop account.
        </p>
      </div>
      <div class="flex-none self-center">
        <ChevronRightIcon class="size-5 text-zinc-500" aria-hidden="true" />
      </div>
    </li>
    <li v-if="mfa.includes(MFAMec.WebAuthn)" class="relative flex gap-x-6 py-6">
      <div
        class="flex size-10 flex-none items-center justify-center rounded-lg bg-zinc-800/50 shadow-xs outline-1 -outline-offset-1 outline-white/10"
      >
        <KeyIcon class="size-6 text-blue-400" aria-hidden="true" />
      </div>
      <div class="flex-auto">
        <h3 class="text-sm/6 font-semibold text-white">
          <NuxtLink :to="{ path: '/auth/mfa/webauthn', query: route.query }">
            <span class="absolute inset-0" aria-hidden="true"></span>
            WebAuthn
          </NuxtLink>
        </h3>
        <p class="mt-2 text-sm/6 text-zinc-400">
          Use a passkey, like biometrics, a hardware security device, or other
          compatible device to sign in to your Drop account.
        </p>
      </div>
      <div class="flex-none self-center">
        <ChevronRightIcon class="size-5 text-zinc-500" aria-hidden="true" />
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import {
  ChevronRightIcon,
  ClockIcon,
  KeyIcon,
} from "@heroicons/vue/24/outline";
import { MFAMec } from "~/prisma/client/enums";

const mfa = await $dropFetch("/api/v1/auth/mfa");
const route = useRoute();
const router = useRouter();

if (mfa.length == 0) router.push("/");
</script>
