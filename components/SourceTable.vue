<template>
  <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
    <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
      <table class="min-w-full divide-y divide-zinc-700">
        <thead>
          <tr>
            <th
              scope="col"
              class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-100 sm:pl-3"
            >
              {{ $t("common.name") }}
            </th>
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
            >
              {{ $t("type") }}
            </th>
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
            >
              {{ $t("library.admin.sources.working") }}
            </th>
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
            >
              {{ $t("options") }}
            </th>
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
            >
              {{ $t("library.admin.sources.totalSpace") }}
            </th>
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
            >
              {{ $t("library.admin.sources.freeSpace") }}
            </th>
            <th
              scope="col"
              class="px-3 py-3.5 text-left text-sm font-semibold text-zinc-100"
            >
              {{ $t("library.admin.sources.utilizationPercentage") }}
            </th>
            <th
              v-if="editSource || deleteSource"
              scope="col"
              class="relative py-3.5 pl-3 pr-4 sm:pr-3"
            >
              <span class="sr-only">{{ $t("actions") }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(source, sourceIdx) in sources" :key="source.id">
            <td
              class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-100 sm:pl-3"
            >
              {{ source.name }}
            </td>
            <td
              class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400 flex gap-x-1 items-center"
            >
              <component
                :is="optionsMetadata[source.backend].icon"
                class="size-5 text-zinc-400"
              />
              {{ optionsMetadata[source.backend].title }}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
              <CheckIcon v-if="source.working" class="size-5 text-green-500" />
              <XMarkIcon v-else class="size-5 text-red-500" />
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
              {{ source.options }}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
              {{ source.fsStats && formatBytes(source.fsStats.totalSpace) }}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-zinc-400">
              {{ source.fsStats && formatBytes(source.fsStats.freeSpace) }}
            </td>
            <td
              class="align-middle flex flex-cols-5 whitespace-nowrap px-3 py-4 text-sm text-zinc-400"
            >
              <div class="flex-auto content-right">
                <ProgressBar
                  v-if="source.fsStats"
                  :percentage="
                    getPercentage(
                      source.fsStats.totalSpace - source.fsStats.freeSpace,
                      source.fsStats.totalSpace,
                    )
                  "
                  :color="
                    getBarColor(
                      getPercentage(
                        source.fsStats.totalSpace - source.fsStats.freeSpace,
                        source.fsStats.totalSpace,
                      ),
                    )
                  "
                  background-color="slate"
                />
              </div>
            </td>
            <td
              v-if="editSource || deleteSource"
              class="relative whitespace-nowrap py-4 pl-3 pr-3 text-right text-sm font-medium space-x-2"
            >
              <button
                v-if="editSource"
                class="text-blue-500 hover:text-blue-400"
                @click="() => editSource(sourceIdx)"
              >
                {{ $t("common.edit") }}
                <span class="sr-only">
                  {{ $t("chars.srComma", [source.name]) }}
                </span>
              </button>

              <button
                v-if="deleteSource"
                class="text-red-500 hover:text-red-400"
                @click="() => deleteSource(sourceIdx)"
              >
                {{ $t("common.delete") }}
                <span class="sr-only">
                  {{ $t("chars.srComma", [source.name]) }}
                </span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkingLibrarySource } from "~/server/api/v1/admin/library/sources/index.get";
import type { LibraryBackend } from "~/prisma/client/enums";
import { BackwardIcon, CheckIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { DropLogo } from "#components";
import { formatBytes } from "~/server/internal/utils/files";
import { getBarColor } from "~/utils/colors";
import { getPercentage } from "~/utils/utils";

const {
  sources,
  deleteSource = undefined,
  editSource = undefined,
} = defineProps<{
  sources: WorkingLibrarySource[];
  summaryMode?: boolean;
  deleteSource?: (id: number) => void;
  editSource?: (id: number) => void;
}>();

const { t } = useI18n();

const optionsMetadata: {
  [key in LibraryBackend]: {
    title: string;
    description: string;
    docsLink: string;
    icon: Component;
  };
} = {
  Filesystem: {
    title: t("library.admin.sources.fsTitle"),
    description: t("library.admin.sources.fsDesc"),
    docsLink: "https://docs.droposs.org/docs/library#drop-style",
    icon: DropLogo,
  },
  FlatFilesystem: {
    title: t("library.admin.sources.fsFlatTitle"),
    description: t("library.admin.sources.fsFlatDesc"),
    docsLink: "https://docs.droposs.org/docs/library#flat-style-or-compat",
    icon: BackwardIcon,
  },
};
</script>
