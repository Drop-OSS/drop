<template>
  <div class="w-full h-max min-h-[30vw] flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-zinc-100">
        {{ $t("auth.code.title") }}
      </h1>
      <p class="mt-1 max-w-sm text-zinc-400 mx-auto">
        {{ $t("auth.code.description") }}
      </p>
      <div v-if="!loading" class="mt-8 flex flex-row gap-4">
        <input
          v-for="i in codeLength"
          ref="codeElements"
          :key="i"
          v-model="code[i - 1]"
          class="uppercase w-16 h-16 appearance-none text-center bg-zinc-900 rounded-xl border-zinc-700 focus:border-blue-600 text-2xl text-bold font-display text-zinc-100"
          type="text"
          pattern="\d*"
          :placeholder="placeholder[i - 1]"
          @keydown="(v) => keydown(i - 1, v)"
          @input="() => input(i - 1)"
          @focusin="() => select(i - 1)"
          @paste="(v) => paste(i - 1, v)"
        />
      </div>
      <div v-else class="mt-8 flex items-center justify-center">
        <svg
          aria-hidden="true"
          class="size-12 text-transparent animate-spin fill-white"
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

      <div
        v-if="error"
        class="mt-8 rounded-md bg-red-600/10 p-4 max-w-sm mx-auto"
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
</template>

<script setup lang="ts">
import { XCircleIcon } from "@heroicons/vue/24/solid";
import { FetchError } from "ofetch";

const codeLength = 7;
const placeholder = "1A2B3C4";
const codeElements = useTemplateRef("codeElements");
const code = ref<string[]>([]);

const router = useRouter();
const loading = ref(false);
const error = ref<string | undefined>(undefined);

function keydown(index: number, event: KeyboardEvent) {
  if (event.key === "Backspace" && !code.value[index] && index > 0) {
    codeElements.value![index - 1].focus();
  }
}

function input(index: number) {
  if (codeElements.value === null) return;
  const v = code.value[index] ?? "";
  if (v.length > 1) code.value[index] = v[0];

  if (!(index + 1 >= codeElements.value.length) && v) {
    codeElements.value[index + 1].focus();
  }

  if (!(index - 1 < 0) && !v) {
    codeElements.value[index - 1].focus();
  }

  console.log(index, codeLength - 1);
  if (index == codeLength - 1) {
    const assembledCode = code.value.join("");
    if (assembledCode.length == codeLength) {
      complete(assembledCode);
    }
  }
}

function select(index: number) {
  if (!codeElements.value) return;
  if (index >= codeElements.value.length) return;
  codeElements.value[index].select();
}

function paste(index: number, event: ClipboardEvent) {
  const newCode = event.clipboardData!.getData("text/plain");
  for (let i = 0; i < newCode.length && i < codeLength; i++) {
    code.value[i] = newCode[i];
    codeElements.value![i].focus();
  }
  event.preventDefault();
}

async function complete(code: string) {
  loading.value = true;
  try {
    const clientId = await $dropFetch(`/api/v1/client/auth/code?code=${code}`);
    router.push(`/client/authorize/${clientId}`);
  } catch (e) {
    if (e instanceof FetchError) {
      error.value =
        e.statusMessage ?? e.message ?? "An unknown error occurred.";
    } else {
      error.value = (e as string)?.toString();
    }
  }
  loading.value = false;
}
</script>
