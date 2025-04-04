import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Nuxt-only config
  telemetry: false,
  compatibilityDate: "2024-04-03",
  devtools: { enabled: false },
  css: ["~/assets/tailwindcss.css", "~/assets/core.scss"],

  experimental: {
    buildCache: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      link: [{ rel: "icon", href: "/favicon.ico" }],
    },
  },

  routeRules: {
    "/auth/**": { prerender: true },
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
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        verbatimModuleSyntax: false,
        skipDefaultLibCheck: true,
        skipLibCheck: true,
      },
    },
  },

  extends: ["./drop-base"],

  // Module config from here down
  modules: [
    "vue3-carousel-nuxt",
    "nuxt-security",
    "@nuxt/image",
    "@nuxt/fonts",
  ],

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
