<template>
  <div class="flex min-h-screen flex-1 bg-zinc-900">
    <div
      class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24"
    >
      <div class="mx-auto w-full max-w-sm lg:w-96">
        <div>
          <DropLogo class="h-10 w-auto" />
          <h2
            class="mt-8 text-2xl font-bold font-display leading-9 tracking-tight text-zinc-100"
          >
            Signing out...
          </h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            You are being signed out of Drop.
          </p>
        </div>
      </div>
    </div>
    <div class="relative hidden w-0 flex-1 lg:block">
      <img
        src="/wallpapers/signin.jpg"
        class="absolute inset-0 h-full w-full object-cover"
        alt=""
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import DropLogo from "~/components/DropLogo.vue";
const router = useRouter();

// Clear the user state
const user = useUser();
user.value = null;

// Redirect to signin page after signout
await $dropFetch("/api/v1/auth/signout"); //TODO: add signout api route
router.push("/auth/signin");
</script>
