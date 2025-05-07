<template>
  <div
    class="flex min-h-screen bg-zinc-950 flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8"
  >
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <DropLogo class="mx-auto h-10 w-auto" />
      <h2
        class="mt-6 text-center text-2xl font-bold font-display leading-9 tracking-tight text-zinc-100"
      >
        Create your Drop account
      </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
      <div class="bg-zinc-900 px-6 py-12 shadow sm:rounded-lg sm:px-12">
        <form class="space-y-6" @submit.prevent="() => register_wrapper()">
          <div>
            <label
              for="display-name"
              class="block text-sm font-medium leading-6 text-zinc-100"
              >Display Name</label
            >
            <div class="mt-2">
              <input
                id="display-name"
                v-model="displayName"
                name="display-name"
                type="text"
                autocomplete="display-name"
                required
                placeholder="AwesomeDropGamer771"
                class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label
              for="email"
              class="block text-sm font-medium leading-6 text-zinc-100"
              >Email address</label
            >
            <p
              :class="[
                validEmail ? 'text-blue-400' : 'text-red-500',
                'block text-xs font-medium leading-6',
              ]"
            >
              Must be in the format user@example.com
            </p>
            <div class="mt-2">
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                :disabled="!!invitation?.email"
                placeholder="me@example.com"
                class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div class="w-full h-px bg-zinc-700" />

          <div>
            <label
              for="username"
              class="block text-sm font-medium leading-6 text-zinc-100"
              >Username</label
            >
            <p
              :class="[
                validUsername ? 'text-blue-400' : 'text-red-500',
                'block text-xs font-medium leading-6',
              ]"
            >
              Must be 5 or more characters, and lowercase
            </p>
            <div class="mt-2">
              <input
                id="username"
                v-model="username"
                name="username"
                type="text"
                autocomplete="username"
                required
                :disabled="!!invitation?.username"
                placeholder="myUsername"
                class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div class="w-full h-px bg-zinc-700" />

          <div>
            <label
              for="password"
              class="block text-sm font-medium leading-6 text-zinc-100"
              >Password</label
            >
            <p
              :class="[
                validPassword ? 'text-blue-400' : 'text-red-500',
                'block text-xs font-medium leading-6',
              ]"
            >
              Must be 14 or more characters
            </p>
            <div class="mt-2">
              <input
                id="password"
                v-model="password"
                name="password"
                type="password"
                autocomplete="password"
                required
                class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label
              for="confirm-password"
              class="block text-sm font-medium leading-6 text-zinc-100"
              >Confirm Password</label
            >
            <p
              :class="[
                validConfirmPassword ? 'text-blue-400' : 'text-red-500',
                'block text-xs font-medium leading-6',
              ]"
            >
              Must be the same as above
            </p>
            <div class="mt-2">
              <input
                id="confirm-password"
                v-model="confirmPassword"
                name="confirm-password"
                type="password"
                autocomplete="confirm-password"
                required
                class="block w-full rounded-md border-0 py-1.5 px-3 bg-zinc-800 disabled:bg-zinc-900/80 text-zinc-100 disabled:text-zinc-400 shadow-sm ring-1 ring-inset ring-zinc-700 disabled:ring-zinc-800 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <LoadingButton type="submit" :loading="loading" class="w-full">
              Create
            </LoadingButton>
          </div>

          <div v-if="error" class="mt-1 rounded-md bg-red-600/10 p-4">
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

      <!-- todo: feature to add custom text here -->
      <p v-if="false" class="mt-10 text-center text-sm text-zinc-400">
        What's Drop?
        {{ " " }}
        <NuxtLink
          to="https://github.com/Drop-OSS/drop"
          target="_blank"
          class="font-semibold leading-6 text-blue-600 hover:text-blue-500"
          >Check us out here &rarr;</NuxtLink
        >
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/24/solid";
import { type } from "arktype";

const route = useRoute();
const router = useRouter();
const invitationId = route.query.id?.toString();
if (!invitationId)
  throw createError({
    statusCode: 400,
    statusMessage: "Invitation required to sign up.",
  });

const invitation = await $dropFetch(
  `/api/v1/auth/signup/simple?id=${encodeURIComponent(invitationId)}`,
);

const email = ref(invitation?.email);
const displayName = ref("");
const username = ref(invitation?.username);
const password = ref("");
const confirmPassword = ref(undefined);

const emailValidator = type("string.email");
const validEmail = computed(
  () => !(emailValidator(email.value) instanceof type.errors),
);

const usernameValidator = type("string.alphanumeric >= 5").to("string.lower");
const validUsername = computed(
  () => !(usernameValidator(username.value) instanceof type.errors),
);

const passwordValidator = type("string >= 14");
const validPassword = computed(
  () => !(passwordValidator(password.value) instanceof type.errors),
);
const validConfirmPassword = computed(
  () => password.value == confirmPassword.value,
);

const loading = ref(false);
const error = ref<string | undefined>(undefined);

async function register() {
  await $dropFetch("/api/v1/auth/signup/simple", {
    method: "POST",
    body: {
      invitation: invitationId,
      username: username.value,
      password: password.value,
      email: email.value,
      displayName: displayName.value,
    },
  });
}

function register_wrapper() {
  if (
    !validEmail.value ||
    !validUsername.value ||
    !validPassword.value ||
    !validConfirmPassword.value
  )
    return;

  loading.value = true;
  register()
    .then(() => {
      router.push("/auth/signin");
    })
    .catch((response) => {
      const message = response.statusMessage || "An unknown error occurred";
      error.value = message;
    })
    .finally(() => {
      loading.value = false;
    });
}

definePageMeta({
  layout: false,
});

useHead({
  title: "Create your Drop account",
});
</script>
