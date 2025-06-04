import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";

// get drop version
const dropVersion = process.env.BUILD_DROP_VERSION ?? "v0.3.0-alpha.1";
// example nightly: "v0.3.0-nightly.2025.05.28"

// get git ref or supply during build
const commitHash =
  process.env.BUILD_GIT_REF ??
  execSync("git rev-parse --short HEAD").toString().trim();

console.log(`Building Drop ${dropVersion} #${commitHash}`);

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ["./drop-base"],

  // Module config from here down
  modules: [
    "vue3-carousel-nuxt",
    "nuxt-security",
    // "@nuxt/image",
    "@nuxt/fonts",
    "@nuxt/eslint",
    "@nuxtjs/i18n",
  ],

  // Nuxt-only config
  telemetry: false,
  compatibilityDate: "2024-04-03",
  devtools: {
    enabled: true,
    telemetry: false,
    timeline: {
      // this seems to be the tracking issue, composables not registered
      // https://github.com/nuxt/devtools/issues/662
      enabled: false,
    },
  },
  css: ["~/assets/tailwindcss.css", "~/assets/core.scss"],

  experimental: {
    buildCache: true,
    viewTransition: true,
    componentIslands: true,
  },

  // future: {
  //   compatibilityVersion: 4,
  // },

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    gitRef: commitHash,
    dropVersion: dropVersion,
  },

  app: {
    head: {
      link: [{ rel: "icon", href: "/favicon.ico" }],
    },
  },

  routeRules: {
    "/api/**": { cors: true },
  },

  nitro: {
    minify: true,
    compressPublicAssets: true,

    experimental: {
      websocket: true,
      tasks: true,
      openAPI: true,
    },

    openAPI: {
      // tracking for dynamic openapi schema https://github.com/nitrojs/nitro/issues/2974
      // create body from types: https://github.com/nitrojs/nitro/issues/3275
      meta: {
        title: "Drop",
        description:
          "Drop is an open-source, self-hosted game distribution platform, creating a Steam-like experience for DRM-free games.",
        version: dropVersion,
      },
    },

    scheduledTasks: {
      "0 * * * *": ["dailyTasks"],
    },

    storage: {
      appCache: {
        driver: "lru-cache",
      },
    },

    devStorage: {
      appCache: {
        // store cache on fs to handle dev server restarts
        driver: "fs",
        base: "./.data/appCache",
      },
    },
  },

  typescript: {
    typeCheck: true,

    tsConfig: {
      compilerOptions: {
        verbatimModuleSyntax: false,
        strictNullChecks: true,
        exactOptionalPropertyTypes: true,
      },
    },
  },

  carousel: {
    prefix: "Vue",
  },

  i18n: {
    defaultLocale: "en-us",
    strategy: "no_prefix",
    experimental: {
      localeDetector: "localeDetector.ts",
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "drop_i18n_redirected",
      fallbackLocale: "en-us",
    },
    locales: [
      { code: "en-us", name: "English", file: "en_us.json" },
      {
        code: "en-pirate",
        name: "English (Pirate)",
        file: "en_pirate.json",
      },
    ],
  },

  security: {
    headers: {
      contentSecurityPolicy: {
        "upgrade-insecure-requests": false,

        "img-src": [
          "'self'",
          "data:",
          "https://www.giantbomb.com",
          "https://images.pcgamingwiki.com",
          "https://images.igdb.com",
        ],
      },
      strictTransportSecurity: false,
    },
    rateLimiter: false,
    xssValidator: false,
  },
});
