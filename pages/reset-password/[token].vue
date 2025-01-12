<template>
  <div class="flex min-h-screen flex-1 bg-zinc-900">
    <div
      class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24"
    >
      <div class="mx-auto w-full max-w-sm lg:w-96">
        <div>
          <Logo class="h-10 w-auto" />
          <h2
            class="mt-8 text-2xl font-bold font-display leading-9 tracking-tight text-zinc-100"
          >
            Reset your password
          </h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Enter your new password below.
          </p>
        </div>

        <div class="mt-10">
          <div>
            <form @submit.prevent="resetPassword" class="space-y-6">
              <div>
                <label
                  for="password"
                  class="block text-sm font-medium leading-6 text-zinc-300"
                  >New Password</label
                >
                <div class="mt-2">
                  <input
                    id="password"
                    v-model="password"
                    name="password"
                    type="password"
                    required
                    class="block w-full rounded-md border-0 py-1.5 px-3 shadow-sm bg-zinc-950/20 text-zinc-300 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div>
                <label
                  for="confirmPassword"
                  class="block text-sm font-medium leading-6 text-zinc-300"
                  >Confirm Password</label
                >
                <div class="mt-2">
                  <input
                    id="confirmPassword"
                    v-model="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    class="block w-full rounded-md border-0 py-1.5 px-3 shadow-sm bg-zinc-950/20 text-zinc-300 ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div>
                <LoadingButton
                  type="submit"
                  :disabled="!isValid"
                  :loading="loading"
                  class="w-full"
                >
                  Reset Password
                </LoadingButton>
              </div>

              <div v-if="error" class="mt-1 rounded-md bg-red-600/10 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <XCircleIcon
                      class="h-5 w-5 text-red-600"
                      aria-hidden="true"
                    />
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
      </div>
    </div>
    <div class="relative hidden w-0 flex-1 lg:block">
      <img
        class="absolute inset-0 h-full w-full object-cover"
        src="/wallpapers/signin.jpg"
        alt=""
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/20/solid";
import Logo from "~/components/Logo.vue";

const route = useRoute();
const token = route.params.token as string;

const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const error = ref<string | undefined>();

const isValid = computed(() => {
  return password.value.length >= 14 && password.value === confirmPassword.value;
});

async function resetPassword() {
  if (!isValid.value) return;
  
  loading.value = true;
  try {
    await $fetch(`/api/v1/admin/users/${token}/reset-password`, {
      method: "POST",
      body: {
        password: password.value,
      },
    });

    // Show success message and redirect to signin page
    createModal(
      ModalType.Notification,
      {
        title: "Success",
        description:
          "Your password has been reset successfully. You can now log in with your new password.",
        buttonText: "Go to Login",
      },
      (e, c) => {
        c();
        navigateTo("/signin");
      }
    );
  } catch (error: any) {
    this.error = error?.statusMessage || "Failed to reset password";
  } finally {
    loading.value = false;
  }
}

// Validate token on page load
onMounted(async () => {
  try {
    const [userId, timestamp] = atob(token).split(":");
    const tokenAge = Date.now() - parseInt(timestamp);

    // Token expires after 24 hours
    if (tokenAge > 24 * 60 * 60 * 1000) {
      throw new Error("Reset link has expired");
    }
  } catch {
    createModal(
      ModalType.Notification,
      {
        title: "Invalid Reset Link",
        description: "This password reset link is invalid or has expired.",
        buttonText: "Go to Login",
      },
      (e, c) => {
        c();
        navigateTo("/signin");
      }
    );
  }
});

definePageMeta({
  layout: false,
});

useHead({
  title: "Reset Password - Drop",
});
</script> 
