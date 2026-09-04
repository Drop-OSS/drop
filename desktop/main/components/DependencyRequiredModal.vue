<template>
  <ModalTemplate :model-value="true">
    <template #default
      ><div class="flex items-start gap-x-3">
        <img :src="useObject(game.mIconObjectId)" class="size-12" />
        <div class="mt-3 text-center sm:mt-0 sm:text-left">
          <h3 class="text-base font-semibold text-zinc-100">
            Missing required dependency "{{ game.mName }}"
          </h3>
          <div class="mt-2">
            <p class="text-sm text-zinc-400">
              To launch this game, you need to have "{{ game.mName }}" ({{
                version.displayName ?? version.versionPath
              }}) installed.
            </p>
          </div>
        </div>
      </div>
      <InstallDirectorySelector
        :install-dirs="installDirs"
        v-model="installDir"
      />

      <div v-if="installError" class="mt-1 rounded-md bg-red-600/10 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <XCircleIcon class="h-5 w-5 text-red-600" aria-hidden="true" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-600">
              {{ installError }}
            </h3>
          </div>
        </div>
      </div>
    </template>
    <template #buttons>
      <LoadingButton
        @click="() => install()"
        :loading="installLoading"
        :disabled="installLoading"
        type="submit"
        class="ml-2 w-full sm:w-fit"
      >
        Install
      </LoadingButton>
      <button
        type="button"
        class="mt-3 inline-flex w-full justify-center rounded-md bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-inset ring-zinc-700 hover:bg-zinc-900 sm:mt-0 sm:w-auto"
        @click="cancel"
        ref="cancelButtonRef"
      >
        Cancel
      </button>
    </template>
  </ModalTemplate>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { XCircleIcon } from "@heroicons/vue/24/solid";

const model = defineModel<{ gameId: string; versionId: string }>({
  required: true,
});

const { game, status } = await useGame(model.value.gameId);

const versionOptions = await invoke<Array<VersionOption>>(
  "fetch_game_version_options",
  {
    gameId: game.id,
  }
);
const version = versionOptions.find(
  (v) => v.versionId === model.value.versionId
)!;

const installDirs = await invoke<string[]>("fetch_download_dir_stats");
const installDir = ref(0);

function cancel() {
  // @ts-expect-error
  model.value = undefined;
}

const installError = ref<string | undefined>();
const installLoading = ref(false);

async function install() {
  try {
    installLoading.value = true;
    await invoke("download_game", {
      gameId: game.id,
      versionId: model.value.versionId,
      installDir: installDir.value,
      targetPlatform: version.platform,
      enableUpdates: versionOptions.indexOf(version) === 0,
    });
    cancel();
  } catch (error) {
    installError.value = (error as string).toString();
  }

  installLoading.value = false;
}
</script>
