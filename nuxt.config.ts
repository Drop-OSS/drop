import path from "path";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Nuxt-only config
  telemetry: false,
  compatibilityDate: "2024-04-03",
  devtools: { enabled: false },
  css: ["~/assets/core.scss"],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
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

  extends: ['./drop-base'],

  // Module config from here down
  modules: ["@nuxt/content", "vue3-carousel-nuxt"],

  carousel: {
    prefix: "Vue",
  },

  content: {
    api: {
      baseURL: "/api/v1/_content",
    },
    markdown: {
      anchorLinks: false,
    },
    sources: {
      content: {
        driver: "fs",
        prefix: "/docs",
        base: path.resolve(__dirname, "docs"),
      },
    },
  },
});
