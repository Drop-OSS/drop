import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Nuxt-only config
  telemetry: false,
  compatibilityDate: "2024-04-03",
  devtools: { enabled: false },
  css: ["~/assets/tailwindcss.css", "~/assets/core.scss"],

  vite: {
    plugins: [
      tailwindcss()
    ]
  },

  app: {
    head: {
      link: [{ rel: "icon", href: "/favicon.ico" }],
    },
  },

  nitro: {
    experimental: {
      websocket: true,
      tasks: true,
    },

    scheduledTasks: {
      "0 * * * *": ["cleanup:invitations"],
    },
  },

  extends: ["./drop-base"],

  // Module config from here down
  modules: [
    "vue3-carousel-nuxt",
    "nuxt-security",
    "@nuxt/image",
  ],

  carousel: {
    prefix: "Vue",
  },

  security: {
    headers: {
      contentSecurityPolicy: {
        //fix for forced https redirection issue
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
  },
});
