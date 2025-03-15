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
    "/signin": { prerender: true },
    "/signout": { prerender: true },

    "/api/**": { cors: true },
  },

  nitro: {
    minify: true,

    experimental: {
      websocket: true,
      tasks: true,
    },

    scheduledTasks: {
      "0 * * * *": ["cleanup:invitations"],
    },

    compressPublicAssets: true,
    publicAssets: [
      {
        baseURL: "wallpapers",
        dir: "public/wallpapers",
        maxAge: 31536000, // 1 year
      },
      {
        baseURL: "fonts",
        dir: "public/fonts",
        maxAge: 31536000, // 1 year
      },
    ],
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
  },
});
