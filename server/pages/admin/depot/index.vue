<template>
  <div class="mx-auto w-full max-w-7xl space-y-8 text-zinc-100">
    <header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Admin · Depot</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight">Catalog discovery</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Discover GOG products and review their metadata before adding them to your depot.
          Discovery never publishes or downloads content by itself.
        </p>
      </div>
      <span class="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-400" />
        GOG provider not connected
      </span>
    </header>

    <section class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <div class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
            <MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 class="text-base font-semibold">Discover catalog entries</h2>
            <p class="mt-1 text-sm leading-6 text-zinc-400">
              Search by title or provide a GOG product ID. Connect a supported account or catalog adapter to retrieve owned products and available releases.
            </p>
          </div>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="discover">
          <div>
            <label for="gog-query" class="mb-2 block text-sm font-medium text-zinc-300">Title or GOG product ID</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                id="gog-query"
                v-model.trim="query"
                type="search"
                autocomplete="off"
                placeholder="e.g. product name or numeric ID"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                :disabled="loading || !query"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
                <MagnifyingGlassIcon v-else class="h-4 w-4" aria-hidden="true" />
                {{ loading ? 'Searching…' : 'Discover' }}
              </button>
            </div>
          </div>
          <p v-if="errorMessage" role="alert" class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
            {{ errorMessage }}
          </p>
        </form>
      </div>

      <aside class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
        <div class="flex items-center gap-3">
          <ShieldCheckIcon class="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <h2 class="text-base font-semibold">Safe ingestion flow</h2>
        </div>
        <ol class="mt-5 space-y-4">
          <li v-for="(step, index) in steps" :key="step.title" class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs font-semibold text-zinc-400">{{ index + 1 }}</span>
            <div>
              <p class="text-sm font-medium text-zinc-200">{{ step.title }}</p>
              <p class="mt-0.5 text-xs leading-5 text-zinc-500">{{ step.description }}</p>
            </div>
          </li>
        </ol>
        <p class="mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">
          Store credentials and acquisition belong in a server-side adapter. Never paste account passwords or tokens here.
        </p>
      </aside>
    </section>

    <section class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">
      <div class="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 class="font-semibold">Discovered products</h2>
          <p class="mt-1 text-sm text-zinc-500">Review identity and available content before choosing what to ingest.</p>
        </div>
        <span class="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">{{ products.length }} results</span>
      </div>

      <div v-if="products.length === 0" class="px-5 py-14 text-center sm:px-6">
        <ArchiveBoxIcon class="mx-auto h-9 w-9 text-zinc-600" aria-hidden="true" />
        <h3 class="mt-4 text-sm font-semibold text-zinc-200">No products discovered</h3>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Connect the GOG discovery provider, then search for a title or sync your owned library. Results will appear here for review.
        </p>
      </div>

      <div v-else class="divide-y divide-zinc-800">
        <article v-for="product in products" :key="product.id" class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-medium text-zinc-100">{{ product.title }}</h3>
              <span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">GOG · {{ product.id }}</span>
            </div>
            <p class="mt-1 text-sm text-zinc-500">{{ product.description || 'No product description provided.' }}</p>
            <p class="mt-2 text-xs text-zinc-500">{{ product.releaseCount }} available release{{ product.releaseCount === 1 ? '' : 's' }}</p>
          </div>
          <button
            type="button"
            :disabled="product.ingesting"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-blue-500/60 hover:bg-blue-500/10 disabled:opacity-50"
            @click="ingest(product)"
          >
            <ArrowDownTrayIcon class="h-4 w-4" aria-hidden="true" />
            {{ product.ingesting ? 'Queueing…' : 'Ingest selected' }}
          </button>
        </article>
      </div>
    </section>

    <p v-if="notice" role="status" class="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">{{ notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline';

definePageMeta({
  layout: 'admin',
});

interface DiscoveredProduct {
  id: string;
  title: string;
  description?: string;
  releaseCount: number;
  ingesting?: boolean;
}

const query = ref('');
const loading = ref(false);
const errorMessage = ref('');
const notice = ref('');
const products = ref<DiscoveredProduct[]>([]);
const steps = [
  { title: 'Discover', description: 'Find owned GOG products and inspect available metadata.' },
  { title: 'Review', description: 'Confirm the product and select the releases to stage.' },
  { title: 'Ingest', description: 'Stage installer assets for verification before publication.' },
];

async function discover() {
  if (!query.value) return;
  loading.value = true;
  errorMessage.value = '';
  notice.value = '';
  try {
    const response = await $fetch<{ products: DiscoveredProduct[] }>(
      '/api/v1/admin/depot/gog/discover',
      { method: 'POST', body: { query: query.value } },
    );
    products.value = response.products;
  } catch (error) {
    products.value = [];
    errorMessage.value = error instanceof Error
      ? `GOG discovery is not available: ${error.message}`
      : 'GOG discovery is not available. Configure a server-side GOG provider and try again.';
  } finally {
    loading.value = false;
  }
}

async function ingest(product: DiscoveredProduct) {
  product.ingesting = true;
  notice.value = '';
  try {
    await $fetch('/api/v1/admin/depot/gog/ingest', {
      method: 'POST',
      body: { productId: product.id },
    });
    notice.value = `Ingestion queued for ${product.title}.`;
  } catch (error) {
    notice.value = error instanceof Error
      ? `Could not queue ${product.title}: ${error.message}`
      : `Could not queue ${product.title}. Configure the server-side ingestion provider first.`;
  } finally {
    product.ingesting = false;
  }
}
</script>
