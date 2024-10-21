<template>
    <div
        v-if="game && unimportedVersions !== undefined"
        class="grid grid-cols-2 gap-16"
    >
        <div class="grow">
            <h1 class="mt-4 text-5xl font-bold font-display text-zinc-100">
                {{ game.mName }}
            </h1>
            <p class="mt-1 text-lg text-zinc-400">
                {{ game.mShortDescription }}
            </p>

            <div
                v-html="descriptionHTML"
                class="mt-5 pt-5 border-t border-zinc-700 prose prose-invert prose-blue"
            ></div>
        </div>
        <div class="space-y-8">
            <div class="px-4 py-3 bg-gray-950 rounded">
                <div class="border-b border-zinc-800 pb-3">
                    <div
                        class="flex flex-wrap items-center justify-between sm:flex-nowrap"
                    >
                        <h3
                            class="text-base font-semibold font-display leading-6 text-zinc-100"
                        >
                            Images
                        </h3>
                        <div class="flex-shrink-0">
                            <button
                                @click="() => (showUploadModal = true)"
                                type="button"
                                class="relative inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
                <div class="mt-3 grid grid-cols-2 grid-flow-dense gap-8">
                    <div
                        v-for="(image, imageIdx) in game.mImageLibrary"
                        :key="image"
                        class="group relative flex items-center"
                    >
                        <img :src="useObject(image)" class="w-full h-auto" />
                        <div
                            class="transition-all opacity-0 group-hover:opacity-100 absolute flex flex-col gap-y-1 top-1 right-1 bg-zinc-950/50 rounded-xl p-2"
                        >
                            <button
                                v-if="image !== game.mBannerId"
                                @click="() => updateBannerImage(image)"
                                type="button"
                                class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            >
                                Set as banner
                            </button>
                            <button
                                v-if="image !== game.mCoverId"
                                @click="() => updateCoverImage(image)"
                                type="button"
                                class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            >
                                Set as cover
                            </button>
                            <button
                                @click="() => deleteImage(image)"
                                type="button"
                                class="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                            >
                                Delete image
                            </button>
                        </div>
                        <div
                            v-if="
                                image === game.mBannerId &&
                                image === game.mCoverId
                            "
                            class="absolute bottom-0 left-0 bg-zinc-950/75 text-zinc-100 text-sm font-semibold px-2 py-1 rounded-tr"
                        >
                            current banner & cover
                        </div>
                        <div
                            v-else-if="image === game.mCoverId"
                            class="absolute bottom-0 left-0 bg-zinc-950/75 text-zinc-100 text-sm font-semibold px-2 py-1 rounded-tr"
                        >
                            current cover
                        </div>
                        <div
                            v-else-if="image === game.mBannerId"
                            class="absolute bottom-0 left-0 bg-zinc-950/75 text-zinc-100 text-sm font-semibold px-2 py-1 rounded-tr"
                        >
                            current banner
                        </div>
                    </div>
                </div>
            </div>
            <div class="py-5 px-6 bg-gray-950 rounded">
                <h1 class="text-2xl font-semibold font-display text-zinc-100">
                    Manage version order
                </h1>
                <div class="text-center w-full text-sm text-zinc-600">
                    lowest
                </div>
                <draggable
                    @update="() => updateVersionOrder()"
                    :list="game.versions"
                    handle=".handle"
                    class="mt-2 space-y-4"
                >
                    <template
                        #item="{ element: item }: { element: GameVersion }"
                    >
                        <div
                            class="w-full inline-flex items-center px-4 py-2 bg-zinc-900 rounded justify-between"
                        >
                            <div class="text-zinc-100 font-semibold">
                                {{ item.versionName }}
                            </div>
                            <div class="text-zinc-400">
                                {{ item.delta ? "Upgrade mode" : "" }}
                            </div>
                            <div class="inline-flex gap-x-2">
                                <Bars3Icon
                                    class="cursor-move w-6 h-6 text-zinc-400 handle"
                                />
                                <button
                                    @click="
                                        () => deleteVersion(item.versionName)
                                    "
                                >
                                    <TrashIcon class="w-5 h-5 text-red-600" />
                                </button>
                            </div>
                        </div>
                    </template>
                </draggable>
                <div
                    class="text-center font-bold text-zinc-400 my-3"
                    v-if="game.versions.length == 0"
                >
                    no versions added
                </div>
                <div class="mt-2 text-center w-full text-sm text-zinc-600">
                    highest
                </div>
            </div>
            <div
                v-if="unimportedVersions.length > 0"
                class="rounded-md bg-blue-600/10 p-4"
            >
                <div class="flex">
                    <div class="flex-shrink-0">
                        <InformationCircleIcon
                            class="h-5 w-5 text-blue-400"
                            aria-hidden="true"
                        />
                    </div>
                    <div class="ml-3 flex-1 md:flex md:justify-between">
                        <p class="text-sm text-blue-400">
                            Drop has detected you have new verions of this game
                            to import.
                        </p>
                        <p class="mt-3 text-sm md:ml-6 md:mt-0">
                            <NuxtLink
                                :href="`/admin/library/${game.id}/import`"
                                class="whitespace-nowrap font-medium text-blue-400 hover:text-blue-500"
                            >
                                Import
                                <span aria-hidden="true"> &rarr;</span>
                            </NuxtLink>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <UploadFileDialog
        v-model="showUploadModal"
        :options="{ id: game.id }"
        accept="image/*"
        endpoint="/api/v1/admin/game/image"
        @upload="(result) => uploadAfterImageUpload(result)"
    />
</template>

<script setup lang="ts">
import { InformationCircleIcon } from "@heroicons/vue/20/solid";
import { Bars3Icon, TrashIcon } from "@heroicons/vue/16/solid";
import type { Game, GameVersion } from "@prisma/client";
import markdownit from "markdown-it";
import UploadFileDialog from "~/components/UploadFileDialog.vue";

definePageMeta({
    layout: "admin",
});

const showUploadModal = ref(false);

const route = useRoute();
const gameId = route.params.id.toString();
const headers = useRequestHeaders(["cookie"]);
const { game: rawGame, unimportedVersions } = await $fetch(
    `/api/v1/admin/game?id=${encodeURIComponent(gameId)}`,
    {
        headers,
    },
);
const game = ref(rawGame);

const md = markdownit();
const descriptionHTML = md.render(game.value?.mDescription ?? "");

async function updateBannerImage(id: string) {
    if (game.value.mBannerId == id) return;
    const { mBannerId } = await $fetch("/api/v1/admin/game", {
        method: "PATCH",
        body: {
            id: gameId,
            mBannerId: id,
        },
    });
    game.value.mBannerId = mBannerId;
}

async function updateCoverImage(id: string) {
    if (game.value.mCoverId == id) return;
    const { mCoverId } = await $fetch("/api/v1/admin/game", {
        method: "PATCH",
        body: {
            id: gameId,
            mCoverId: id,
        },
    });
    game.value.mCoverId = mCoverId;
}

async function deleteImage(id: string) {
    const { mBannerId, mImageLibrary } = await $fetch(
        "/api/v1/admin/game/image",
        {
            method: "DELETE",
            body: {
                gameId: game.value.id,
                imageId: id,
            },
        },
    );
    game.value.mImageLibrary = mImageLibrary;
    game.value.mBannerId = mBannerId;
}

async function uploadAfterImageUpload(result: Game) {
    if (!game.value) return;
    game.value.mImageLibrary = result.mImageLibrary;
}

async function deleteVersion(versionName: string) {
    await $fetch("/api/v1/admin/game/version", {
        method: "DELETE",
        body: {
            id: gameId,
            versionName: versionName,
        },
    });
    game.value.versions.splice(
        game.value.versions.findIndex((e) => e.versionName === versionName),
        1,
    );
}

async function updateVersionOrder() {
    const newVersions = await $fetch("/api/v1/admin/game/version", {
        method: "POST",
        body: {
            id: gameId,
            versions: game.value.versions.map((e) => e.versionName),
        },
    });
    game.value.versions = newVersions;
}
</script>
