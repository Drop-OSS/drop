<template>
  <div class="mx-auto w-full max-w-7xl space-y-8 text-zinc-100">
    <header
      class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400"
        >
          Admin · Depot
        </p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight">
          Catalog discovery
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Discover owned products and review their metadata before adding them
          to your depot. Discovery never publishes or downloads content by
          itself.
        </p>
      </div>
      <span
        class="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
        :class="
          activeConnection
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="activeConnection ? 'bg-emerald-400' : 'bg-amber-400'"
        />
        {{
          activeConnection
            ? `${activeProvider.label} connected: ${activeConnection.accountId}`
            : `${activeProvider.label} provider not connected`
        }}
      </span>
    </header>

    <!-- Provider selector: minimal addition; GOG flow below remains untouched. -->
    <nav aria-label="Store provider" class="flex flex-wrap gap-2">
      <button
        v-for="provider in providers"
        :key="provider.id"
        type="button"
        :aria-pressed="provider.id === activeProviderId"
        class="rounded-lg border px-3.5 py-2 text-sm font-medium transition"
        :class="
          provider.id === activeProviderId
            ? 'border-blue-500/60 bg-blue-500/10 text-blue-200'
            : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'
        "
        @click="selectProvider(provider.id)"
      >
        {{ provider.label }}
      </button>
    </nav>

    <!-- Stored store-account connection, shared by every provider section. -->
    <section
      class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
    >
      <div
        v-if="activeConnection"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
      >
        <p class="text-sm text-emerald-200">
          Connected to {{ activeProvider.label }} as
          <span class="font-semibold">{{ activeConnection.accountId }}</span>
          <span v-if="activeConnection.expiresAt">
            · expires {{ formatExpiry(activeConnection.expiresAt) }}</span
          >
          <span v-if="activeConnection.hasRefreshToken">
            · refreshes automatically</span
          >
        </p>
        <button
          type="button"
          class="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/10"
          @click="disconnect"
        >
          Disconnect
        </button>
      </div>
      <template v-else>
        <div
          v-if="activeProviderId === 'gog'"
          class="mb-4 flex flex-wrap items-center gap-3"
        >
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            @click="startGogSignIn"
          >
            <ShieldCheckIcon class="h-4 w-4" aria-hidden="true" />
            Sign in with GOG
          </button>
          <span class="text-xs text-zinc-500">
            after signing in, GOG lands on embed.gog.com/on_login_success?
            origin=client&code=... - copy that code from the address bar and
            paste it below
          </span>
        </div>
        <div
          v-if="activeProviderId === 'ea' && eaLoginAvailable"
          class="mb-4 flex flex-wrap items-center gap-3"
        >
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            @click="openEaLoginPage"
          >
            <ShieldCheckIcon class="h-4 w-4" aria-hidden="true" />
            Open EA sign-in page
          </button>
          <span class="text-xs text-zinc-500">
            after signing in, the browser lands on your configured redirect -
            copy the code= value from its address into the field below
          </span>
        </div>
        <p
          v-else-if="activeProviderId === 'ea'"
          class="mb-4 text-xs text-zinc-500"
        >
          EA offers no public sign-in client for third-party apps, so browser
          sign-in is only available when this server is configured with an EA
          OAuth client (EA_OAUTH_CLIENT_ID, EA_OAUTH_CLIENT_SECRET and
          EA_OAUTH_REDIRECT_URI). Otherwise paste an access token (plus refresh
          token) copied from an existing EA app / Origin installation.
        </p>
        <form class="flex flex-col gap-3" @submit.prevent="connect">
          <div class="flex flex-col gap-3">
            <template v-if="activeProviderId === 'gog'">
              <label for="gog-connect-code" class="sr-only">
                GOG sign-in code
              </label>
              <input
                id="gog-connect-code"
                v-model.trim="gogConnectCode"
                type="password"
                autocomplete="off"
                placeholder="Sign-in code (from embed.gog.com) or full URL"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <details class="w-full">
                <summary
                  class="cursor-pointer select-none text-xs text-zinc-500"
                >
                  Or paste an existing token (Heroic users: both live in
                  ~/.config/heroic/gog_store/auth.json)
                </summary>
                <div class="mt-3 flex flex-col gap-3">
                  <label for="gog-connect-token" class="sr-only">
                    GOG access token
                  </label>
                  <input
                    id="gog-connect-token"
                    v-model.trim="gogConnectToken"
                    type="password"
                    autocomplete="off"
                    placeholder="GOG access token"
                    class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <label for="gog-connect-refresh" class="sr-only">
                    GOG refresh token (optional)
                  </label>
                  <input
                    id="gog-connect-refresh"
                    v-model.trim="gogRefreshToken"
                    type="password"
                    autocomplete="off"
                    placeholder="Refresh token (optional - enables auto-renewal)"
                    class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <label for="gog-connect-account" class="sr-only">
                    GOG account ID (optional)
                  </label>
                  <input
                    id="gog-connect-account"
                    v-model.trim="gogAccountId"
                    type="text"
                    autocomplete="off"
                    placeholder="Account id (only for non-JWT tokens)"
                    class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </details>
            </template>
            <template v-else-if="activeProviderId === 'epic'">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-blue-500/60 hover:bg-blue-500/10"
                @click="openEpicLoginPage"
              >
                <ShieldCheckIcon class="h-4 w-4" aria-hidden="true" />
                Open Epic sign-in page
              </button>
              <label for="epic-connect-code" class="sr-only">
                Epic authorization code
              </label>
              <input
                id="epic-connect-code"
                v-model.trim="epicConnectCode"
                type="password"
                autocomplete="off"
                placeholder="Authorization code (or paste the whole JSON page)"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <label for="epic-refresh-token" class="sr-only">
                Epic refresh token
              </label>
              <input
                id="epic-refresh-token"
                v-model.trim="epicRefreshToken"
                type="password"
                autocomplete="off"
                placeholder="Refresh token (if you already have one)"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <label for="epic-account-id" class="sr-only"
                >Epic account ID</label
              >
              <input
                id="epic-account-id"
                v-model.trim="epicAccountId"
                type="text"
                autocomplete="off"
                placeholder="Account id (optional - derived from the code)"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </template>
            <template v-else-if="activeProviderId === 'ubisoft'">
              <label for="ubisoft-email" class="sr-only">
                Ubisoft account email
              </label>
              <input
                id="ubisoft-email"
                v-model.trim="ubisoftEmail"
                type="email"
                autocomplete="off"
                placeholder="Ubisoft account email"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <label for="ubisoft-password" class="sr-only">
                Ubisoft password
              </label>
              <input
                id="ubisoft-password"
                v-model.trim="ubisoftPassword"
                type="password"
                autocomplete="off"
                placeholder="Password"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <label v-if="ubisoftTwoFactorTicket" for="ubisoft-code">
                <span class="sr-only">Ubisoft 2FA code</span>
                <input
                  id="ubisoft-code"
                  v-model.trim="ubisoftCode"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  placeholder="2FA code (Ubisoft asked for one)"
                  class="min-w-0 flex-1 rounded-lg border border-amber-500/40 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
              <details class="w-full">
                <summary
                  class="cursor-pointer select-none text-xs text-zinc-500"
                >
                  Or paste an existing Ubisoft Connect ticket
                </summary>
                <div class="mt-3 flex flex-col gap-3">
                  <label for="ubisoft-ticket" class="sr-only">
                    Ubisoft session ticket
                  </label>
                  <input
                    id="ubisoft-ticket"
                    v-model.trim="ubisoftTicket"
                    type="password"
                    autocomplete="off"
                    placeholder="Ubisoft Connect session ticket"
                    class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <label for="ubisoft-user-id" class="sr-only">
                    Ubisoft account user ID
                  </label>
                  <input
                    id="ubisoft-user-id"
                    v-model.trim="ubisoftUserId"
                    type="text"
                    autocomplete="off"
                    placeholder="Ubisoft user ID"
                    class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </details>
            </template>
            <template v-else>
              <template v-if="eaLoginAvailable">
                <label for="ea-connect-code" class="sr-only">
                  EA sign-in code
                </label>
                <input
                  id="ea-connect-code"
                  v-model.trim="eaConnectCode"
                  type="password"
                  autocomplete="off"
                  placeholder="Sign-in code (from the EA redirect) or its full URL"
                  class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </template>
              <label for="ea-connect-token" class="sr-only"
                >EA access token</label
              >
              <input
                id="ea-connect-token"
                v-model.trim="eaConnectToken"
                type="password"
                autocomplete="off"
                :placeholder="
                  eaLoginAvailable ? '…or EA access token' : 'EA access token'
                "
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <label for="ea-refresh-token" class="sr-only">
                EA refresh token (optional)
              </label>
              <input
                id="ea-refresh-token"
                v-model.trim="eaRefreshToken"
                type="password"
                autocomplete="off"
                placeholder="EA refresh token (optional)"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <label for="ea-account-id" class="sr-only">
                EA account pid (optional)
              </label>
              <input
                id="ea-account-id"
                v-model.trim="eaAccountId"
                type="text"
                autocomplete="off"
                placeholder="EA pid (optional - derived from token)"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </template>
            <button
              type="submit"
              :disabled="connecting || !canConnect"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowPathIcon
                v-if="connecting"
                class="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <ShieldCheckIcon v-else class="h-4 w-4" aria-hidden="true" />
              {{ connecting ? "Connecting…" : "Connect account" }}
            </button>
          </div>
          <p class="text-xs leading-5 text-zinc-500">
            Credentials are stored on the server, never sent back to this page.
            Where the store supports it (Epic, EA, GOG with a refresh token,
            Ubisoft sign-in) stored credentials renew themselves; pasted
            sessions that expire must be connected again.
          </p>
        </form>
      </template>
    </section>

    <section
      v-if="activeProviderId === 'gog'"
      class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
    >
      <div class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300"
          >
            <MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 class="text-base font-semibold">Discover catalog entries</h2>
            <p class="mt-1 text-sm leading-6 text-zinc-400">
              Search by title or provide a GOG product ID. Connect a supported
              account or catalog adapter to retrieve owned products and
              available releases.
            </p>
          </div>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="discoverGog">
          <div>
            <label
              for="gog-query"
              class="mb-2 block text-sm font-medium text-zinc-300"
              >Title or GOG product ID</label
            >
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                id="gog-query"
                v-model.trim="gogQuery"
                type="search"
                autocomplete="off"
                placeholder="e.g. product name or numeric ID"
                class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                :disabled="loading || !gogQuery"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowPathIcon
                  v-if="loading"
                  class="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                <MagnifyingGlassIcon
                  v-else
                  class="h-4 w-4"
                  aria-hidden="true"
                />
                {{ loading ? "Searching…" : "Discover" }}
              </button>
            </div>
          </div>
          <p
            v-if="errorMessage"
            role="alert"
            class="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200"
          >
            {{ errorMessage }}
          </p>
        </form>
      </div>

      <aside
        class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
      >
        <div class="flex items-center gap-3">
          <ShieldCheckIcon
            class="h-5 w-5 text-emerald-400"
            aria-hidden="true"
          />
          <h2 class="text-base font-semibold">Safe ingestion flow</h2>
        </div>
        <ol class="mt-5 space-y-4">
          <li
            v-for="(step, index) in steps"
            :key="step.title"
            class="flex gap-3"
          >
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs font-semibold text-zinc-400"
              >{{ index + 1 }}</span
            >
            <div>
              <p class="text-sm font-medium text-zinc-200">{{ step.title }}</p>
              <p class="mt-0.5 text-xs leading-5 text-zinc-500">
                {{ step.description }}
              </p>
            </div>
          </li>
        </ol>
        <p
          class="mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500"
        >
          Store credentials belong on the server: use Connect account above and
          discovery endpoints will pick the stored credential up by themselves.
          Tokens are never echoed back to the browser.
        </p>
      </aside>
    </section>

    <section
      v-else
      class="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
    >
      <div class="flex items-start gap-4">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300"
        >
          <MagnifyingGlassIcon class="h-5 w-5" aria-hidden="true" />
        </div>
        <div class="grow">
          <h2 class="text-base font-semibold">
            Owned {{ activeProvider.label }} titles
          </h2>
          <p class="mt-1 text-sm leading-6 text-zinc-400">
            {{ providerDescription }}
          </p>
        </div>
      </div>

      <form class="mt-6 flex flex-col gap-3" @submit.prevent="loadLibrary">
        <div
          v-if="activeProviderId === 'ea'"
          class="flex flex-col gap-3 sm:flex-row"
        >
          <label for="ea-search" class="sr-only">EA catalog search</label>
          <input
            id="ea-search"
            v-model.trim="eaSearch"
            type="search"
            placeholder="Optional: also search the EA catalog"
            class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            :disabled="loading || !activeConnection"
            class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowPathIcon
              v-if="loading"
              class="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            <MagnifyingGlassIcon v-else class="h-4 w-4" aria-hidden="true" />
            {{ loading ? "Loading…" : "Load owned titles" }}
          </button>
        </div>
      </form>
      <p
        v-if="errorMessage"
        role="alert"
        class="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200"
      >
        {{ errorMessage }}
      </p>
    </section>

    <section
      class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70"
    >
      <div
        class="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <div>
          <h2 class="font-semibold">Discovered products</h2>
          <p class="mt-1 text-sm text-zinc-500">
            Review identity and available content before choosing what to
            ingest.
          </p>
        </div>
        <span
          class="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400"
          >{{ products.length }} results</span
        >
      </div>

      <div v-if="products.length === 0" class="px-5 py-14 text-center sm:px-6">
        <ArchiveBoxIcon
          class="mx-auto h-9 w-9 text-zinc-600"
          aria-hidden="true"
        />
        <h3 class="mt-4 text-sm font-semibold text-zinc-200">
          No products discovered
        </h3>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Connect the {{ activeProvider.label }} discovery provider, then search
          for a title or sync your owned library. Results will appear here for
          review.
        </p>
      </div>

      <div v-else class="divide-y divide-zinc-800">
        <article
          v-for="product in products"
          :key="product.id"
          class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-medium text-zinc-100">{{ product.title }}</h3>
              <span
                class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                >{{ activeProvider.label }} · {{ product.id }}</span
              >
            </div>
            <p class="mt-1 text-sm text-zinc-500">
              {{ product.description || "No product description provided." }}
            </p>
            <p
              v-if="product.releaseCount !== undefined"
              class="mt-2 text-xs text-zinc-500"
            >
              {{ product.releaseCount }} available release{{
                product.releaseCount === 1 ? "" : "s"
              }}
            </p>
            <div v-if="activeProviderId === 'ea'" class="mt-3">
              <label
                :for="`ea-archive-${product.id}`"
                class="mb-1.5 block text-xs text-zinc-500"
                >Game archive URL (HTTPS; pre-filled from the entitlement
                link)</label
              >
              <input
                :id="`ea-archive-${product.id}`"
                v-model.trim="product.archiveUrl"
                type="url"
                autocomplete="off"
                placeholder="https:// …/archive.zip"
                class="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <button
            type="button"
            :disabled="
              product.ingesting ||
              (activeProviderId === 'ea' && !product.archiveUrl)
            "
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:border-blue-500/60 hover:bg-blue-500/10 disabled:opacity-50"
            @click="ingest(product)"
          >
            <ArrowDownTrayIcon class="h-4 w-4" aria-hidden="true" />
            {{ product.ingesting ? "Queueing…" : "Ingest selected" }}
          </button>
        </article>
      </div>
    </section>

    <p
      v-if="notice"
      role="status"
      class="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300"
    >
      {{ notice }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from "@heroicons/vue/24/outline";

definePageMeta({
  layout: "admin",
});

type ProviderId = "gog" | "epic" | "ubisoft" | "ea";

interface DiscoveredProduct {
  id: string;
  title: string;
  description?: string;
  releaseCount?: number;
  ingesting?: boolean;
  // Epic: identifiers required by the Epic ingest endpoint.
  namespace?: string;
  catalogItemId?: string;
  appName?: string;
  // Ubisoft: identifiers required by the Ubisoft ingest endpoint.
  spaceId?: string;
  userId?: string;
  gameTitle?: string;
  // EA: the ingest endpoint needs a title plus an HTTPS archive URL. The
  // entitlement's download link pre-fills it; it stays editable because EA
  // links are short-lived.
  archiveUrl?: string;
}

// Shape returned by the Epic and Ubisoft library endpoints.
interface OwnedGame {
  // Epic entitlements
  namespace?: string;
  catalogItemId?: string;
  appName?: string;
  title?: string;
  entitlementName?: string;
  // Ubisoft owned titles
  spaceId?: string;
  gameId?: string;
  name?: string;
  ownedDate?: string;
  // EA owned games (normalized by the library utility)
  id?: string;
  offerId?: string;
  downloadLink?: string;
}

const providers: Array<{ id: ProviderId; label: string }> = [
  { id: "gog", label: "GOG" },
  { id: "epic", label: "Epic" },
  { id: "ubisoft", label: "Ubisoft" },
  { id: "ea", label: "EA" },
];

const activeProviderId = ref<ProviderId>("gog");
const activeProvider = computed(
  () => providers.find((p) => p.id === activeProviderId.value) || providers[0],
);

const gogQuery = ref("");
const ubisoftUserId = ref("");
const eaSearch = ref("");
// Connect-form fields, cleared as soon as the server accepts the credentials.
const gogConnectCode = ref("");
const gogConnectToken = ref("");
const gogRefreshToken = ref("");
const gogAccountId = ref("");
const epicConnectCode = ref("");
const epicAccountId = ref("");
const epicRefreshToken = ref("");
const ubisoftEmail = ref("");
const ubisoftPassword = ref("");
const ubisoftCode = ref("");
// Set when Ubisoft answers a login with a 2FA challenge; the next Connect
// sends this ticket plus the user's code instead of credentials.
const ubisoftTwoFactorTicket = ref("");
const ubisoftTicket = ref("");
const eaConnectCode = ref("");
const eaConnectToken = ref("");
const eaRefreshToken = ref("");
const eaAccountId = ref("");
const loading = ref(false);
const connecting = ref(false);
const errorMessage = ref("");
const notice = ref("");
const products = ref<DiscoveredProduct[]>([]);

interface StoredConnection {
  id: string;
  provider: string;
  accountId: string;
  username: string | null;
  expiresAt: string | null;
  hasRefreshToken: boolean;
  updatedAt: string | null;
}

const connections = ref<StoredConnection[]>([]);
const activeConnection = computed(() =>
  connections.value.find((c) => c.provider === activeProviderId.value),
);

const providerDescription = computed(() =>
  activeProviderId.value === "epic"
    ? "Connect an Epic account with a refresh token so the server can keep its entitlements fresh. Loads the entitlements owned by that account; ingest streams the raw depot files directly into the depot."
    : activeProviderId.value === "ea"
      ? "EA grants no public sign-in client, so browser sign-in works only when this server is configured with an EA OAuth client; otherwise paste an access token (and refresh token) from an existing EA app installation. Discovery lists entitled games and can be widened by a catalog search; ingest streams the game archive into the depot from a provided download link."
      : "Sign in with your Ubisoft email and password - the password is used for the single sign-in and never stored; the session ticket and a remember-me ticket are kept and renewed automatically. A two-factor code may be requested once. Loads the titles owned by that account; ingest streams the raw game files directly into the depot.",
);

const canConnect = computed(() => {
  switch (activeProviderId.value) {
    case "gog":
      return Boolean(gogConnectCode.value || gogConnectToken.value);
    case "epic":
      return Boolean(epicConnectCode.value || epicRefreshToken.value);
    case "ubisoft":
      return Boolean(
        (ubisoftEmail.value && ubisoftPassword.value) ||
        (ubisoftTwoFactorTicket.value && ubisoftCode.value) ||
        (ubisoftTicket.value && ubisoftUserId.value),
      );
    default:
      return Boolean(
        eaConnectCode.value || eaConnectToken.value || eaRefreshToken.value,
      );
  }
});

async function loadConnections() {
  try {
    const response = await $fetch<{ connections: StoredConnection[] }>(
      "/api/admin/depot/connection",
    );
    connections.value = response.connections;
  } catch {
    // The connection store may be unreachable on a fresh install; the
    // endpoints still accept one-off caller tokens, so stay quiet here.
    connections.value = [];
  }
}

onMounted(() => {
  loadConnections();
  probeEaLogin();
});

// EA grants no public OAuth clients, so browser sign-in is only offered when
// the server has a confidential client configured; probe once on mount.
const eaLoginAvailable = ref(false);

async function probeEaLogin() {
  try {
    const { loginUrl } = await $fetch<{ loginUrl: string | null }>(
      "/api/admin/depot/connection/ea/login-url",
    );
    eaLoginAvailable.value = Boolean(loginUrl);
  } catch {
    eaLoginAvailable.value = false;
  }
}

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function connect() {
  if (!canConnect.value || connecting.value) return;
  connecting.value = true;
  resetError();
  const provider = activeProviderId.value;
  const body: Record<string, string> = { provider };
  if (provider === "gog") {
    if (gogConnectCode.value) body.code = gogConnectCode.value;
    if (gogConnectToken.value) body.accessToken = gogConnectToken.value;
    if (gogRefreshToken.value) body.refreshToken = gogRefreshToken.value;
    if (gogAccountId.value) body.accountId = gogAccountId.value;
  }
  if (provider === "epic") {
    if (epicAccountId.value) body.accountId = epicAccountId.value;
    if (epicConnectCode.value) body.code = epicConnectCode.value;
    if (epicRefreshToken.value) body.refreshToken = epicRefreshToken.value;
  }
  if (provider === "ubisoft") {
    if (ubisoftTwoFactorTicket.value && ubisoftCode.value) {
      body.twoFactorTicket = ubisoftTwoFactorTicket.value;
      body.code = ubisoftCode.value;
    } else if (ubisoftEmail.value && ubisoftPassword.value) {
      body.email = ubisoftEmail.value;
      body.password = ubisoftPassword.value;
    } else {
      body.ticket = ubisoftTicket.value;
      body.userId = ubisoftUserId.value;
    }
  }
  if (provider === "ea") {
    if (eaConnectCode.value) body.code = eaConnectCode.value;
    if (eaConnectToken.value) body.accessToken = eaConnectToken.value;
    if (eaRefreshToken.value) body.refreshToken = eaRefreshToken.value;
    if (eaAccountId.value) body.accountId = eaAccountId.value;
  }
  try {
    const response = await $fetch<{
      connected: boolean;
      connection?: StoredConnection;
      twoFactor?: {
        requiresTwoFactor: true;
        twoFactorTicket: string;
        method: string;
      };
    }>("/api/admin/depot/connection", { method: "POST", body });
    if (response.twoFactor) {
      // Ubisoft wants a one-time code; the next Connect sends the ticket
      // and the typed code, not the password again.
      ubisoftTwoFactorTicket.value = response.twoFactor.twoFactorTicket;
      ubisoftPassword.value = "";
      errorMessage.value = `Ubisoft requires a two-factor code (${response.twoFactor.method} - check your authenticator app or email), then press Connect again.`;
      return;
    }
    if (!response.connection)
      throw new Error("The server accepted the request without a connection.");
    gogConnectCode.value = "";
    gogConnectToken.value = "";
    gogRefreshToken.value = "";
    epicConnectCode.value = "";
    epicRefreshToken.value = "";
    ubisoftPassword.value = "";
    ubisoftCode.value = "";
    ubisoftTwoFactorTicket.value = "";
    ubisoftTicket.value = "";
    eaConnectCode.value = "";
    eaConnectToken.value = "";
    eaRefreshToken.value = "";
    await loadConnections();
    notice.value = `Connected ${activeProvider.value.label} account ${response.connection.accountId}.`;
  } catch (error) {
    const challenge = (
      error as {
        data?: {
          requiresTwoFactor?: boolean;
          twoFactorTicket?: string;
          method?: string;
        };
      }
    )?.data;
    if (
      provider === "ubisoft" &&
      challenge?.requiresTwoFactor &&
      challenge.twoFactorTicket
    ) {
      // Ubisoft wants a 2FA code; keep the email/password out of the next
      // attempt and send the challenge ticket plus the user's code instead.
      ubisoftTwoFactorTicket.value = challenge.twoFactorTicket;
      errorMessage.value = `Ubisoft requires a two-factor code (${challenge?.method ?? "unknown method"} - check your authenticator app or email), then press Connect again.`;
    } else
      errorMessage.value =
        error instanceof Error
          ? `Could not connect the ${activeProvider.value.label} account: ${error.message}`
          : `Could not connect the ${activeProvider.value.label} account.`;
  } finally {
    connecting.value = false;
  }
}

async function startGogSignIn() {
  try {
    const { authorizeUrl } = await $fetch<{ authorizeUrl: string }>(
      "/api/admin/depot/connection/gog/authorize",
    );
    window.open(authorizeUrl, "_blank", "noopener");
    notice.value =
      "Sign in at GOG in the new tab - it ends on embed.gog.com/on_login_success?origin=client&code=... - copy the code from the address bar into the field below.";
  } catch (error) {
    notice.value =
      error instanceof Error
        ? `Could not start the GOG sign-in: ${error.message}`
        : "Could not start the GOG sign-in.";
  }
}

async function openEpicLoginPage() {
  try {
    const { loginUrl } = await $fetch<{ loginUrl: string }>(
      "/api/admin/depot/connection/epic/login-url",
    );
    window.open(loginUrl, "_blank", "noopener");
    notice.value =
      "After signing in, Epic shows a page of JSON - select all of it and paste it below (or just the code value), then press Connect.";
  } catch (error) {
    notice.value =
      error instanceof Error
        ? `Could not get the Epic sign-in URL: ${error.message}`
        : "Could not get the Epic sign-in URL.";
  }
}

async function openEaLoginPage() {
  try {
    const { loginUrl } = await $fetch<{ loginUrl: string | null }>(
      "/api/admin/depot/connection/ea/login-url",
    );
    if (!loginUrl) {
      eaLoginAvailable.value = false;
      notice.value =
        "This server has no EA OAuth client configured, so browser sign-in is unavailable - paste an access token from an existing EA app installation, or configure EA_OAUTH_CLIENT_ID/EA_OAUTH_CLIENT_SECRET/EA_OAUTH_REDIRECT_URI on the server.";
      return;
    }
    window.open(loginUrl, "_blank", "noopener");
    notice.value =
      "Sign in at EA - the browser then lands on your configured redirect address. Copy the code= value from it (or the whole address) into the sign-in code field.";
  } catch (error) {
    notice.value =
      error instanceof Error
        ? `Could not get the EA sign-in URL: ${error.message}`
        : "Could not get the EA sign-in URL.";
  }
}

async function disconnect() {
  const connection = activeConnection.value;
  if (!connection) return;
  try {
    await $fetch(`/api/admin/depot/connection/${connection.id}`, {
      method: "DELETE",
    });
    await loadConnections();
    notice.value = `Disconnected the stored ${connection.accountId} account.`;
  } catch (error) {
    notice.value =
      error instanceof Error
        ? `Could not disconnect: ${error.message}`
        : "Could not disconnect the stored account.";
  }
}
const steps = [
  {
    title: "Discover",
    description: "Find owned GOG products and inspect available metadata.",
  },
  {
    title: "Review",
    description: "Confirm the product and select the releases to stage.",
  },
  {
    title: "Ingest",
    description: "Stage installer assets for verification before publication.",
  },
];

function selectProvider(id: ProviderId) {
  if (activeProviderId.value === id) return;
  activeProviderId.value = id;
  products.value = [];
  errorMessage.value = "";
  notice.value = "";
}

function resetError() {
  errorMessage.value = "";
  notice.value = "";
}

async function discoverGog() {
  if (!gogQuery.value) return;
  loading.value = true;
  resetError();
  try {
    const response = await $fetch<{
      games: Array<{ id: string; title: string }>;
    }>("/api/admin/depot/gog/library", {
      method: "GET",
      query: { title: gogQuery.value },
    });
    products.value = response.games.map((game) => ({
      id: game.id,
      title: game.title,
    }));
  } catch (error) {
    products.value = [];
    errorMessage.value =
      error instanceof Error
        ? `GOG discovery is not available: ${error.message}`
        : "GOG discovery is not available. Configure a server-side GOG provider and try again.";
  } finally {
    loading.value = false;
  }
}

async function loadLibrary() {
  loading.value = true;
  resetError();
  try {
    // Credentials come from the stored connection; only per-query options
    // travel here.
    const query =
      activeProviderId.value === "ubisoft" && ubisoftUserId.value
        ? { userId: ubisoftUserId.value }
        : activeProviderId.value === "ea" && eaSearch.value
          ? { search: eaSearch.value }
          : undefined;
    // All non-GOG endpoints return the list under `games`.
    const response = await $fetch<{ games: OwnedGame[] }>(
      `/api/admin/depot/${activeProviderId.value}/library`,
      { method: "GET", query },
    );
    products.value = response.games
      .map((game) => {
        if (activeProviderId.value === "epic") {
          return {
            id: game.catalogItemId || game.appName || game.namespace || "",
            title:
              game.title ||
              game.entitlementName ||
              game.appName ||
              game.catalogItemId ||
              "Untitled",
            namespace: game.namespace,
            catalogItemId: game.catalogItemId,
            appName: game.appName,
          };
        }
        if (activeProviderId.value === "ea") {
          // The EA endpoint returns rows already normalized by the utility.
          return {
            id: game.id || game.offerId || "",
            title: game.title || game.offerId || "Untitled",
            gameTitle: game.title || game.offerId,
            archiveUrl: game.downloadLink ?? "",
          };
        }
        return {
          id: game.spaceId || game.gameId || "",
          title: game.name || game.spaceId || "Untitled",
          spaceId: game.spaceId,
          userId: ubisoftUserId.value || activeConnection.value?.accountId,
          gameTitle: game.name || game.spaceId,
        };
      })
      .filter((product) => product.id);
  } catch (error) {
    products.value = [];
    const label = activeProvider.value.label;
    errorMessage.value =
      error instanceof Error
        ? `${label} library is not available: ${error.message}`
        : `${label} library is not available. Link a ${label} account on the server first.`;
  } finally {
    loading.value = false;
  }
}

async function ingest(product: DiscoveredProduct) {
  product.ingesting = true;
  notice.value = "";
  try {
    if (activeProviderId.value === "gog") {
      await $fetch("/api/admin/depot/gog/ingest", {
        method: "POST",
        body: { gameId: product.id },
      });
    } else if (activeProviderId.value === "epic") {
      await $fetch("/api/admin/depot/epic/ingest", {
        method: "POST",
        body: {
          namespace: product.namespace,
          catalogItemId: product.catalogItemId,
          appName: product.appName,
        },
      });
    } else if (activeProviderId.value === "ea") {
      await $fetch("/api/admin/depot/ea/ingest", {
        method: "POST",
        body: {
          gameTitle: product.gameTitle || product.title,
          archiveUrl: product.archiveUrl,
        },
      });
    } else {
      await $fetch("/api/admin/depot/ubisoft/ingest", {
        method: "POST",
        body: {
          spaceId: product.spaceId,
          userId: product.userId,
          gameTitle: product.gameTitle || product.title,
        },
      });
    }
    notice.value = `Ingestion queued for ${product.title}.`;
  } catch (error) {
    const label = activeProvider.value.label;
    notice.value =
      error instanceof Error
        ? `Could not queue ${product.title}: ${error.message}`
        : `Could not queue ${product.title}. Configure the server-side ${label} ingestion provider first.`;
  } finally {
    product.ingesting = false;
  }
}
</script>
