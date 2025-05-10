import tailwindcss from "@tailwindcss/vite";

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
  },

  // future: {
  //   compatibilityVersion: 4,
  // },

  vite: {
    plugins: [tailwindcss()],
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

    experimental: {
      websocket: true,
      tasks: true,
    },

    scheduledTasks: {
      "0 * * * *": ["cleanup:invitations", "cleanup:sessions"],
    },

    compressPublicAssets: true,

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
