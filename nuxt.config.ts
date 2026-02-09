import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import module from "node:module";
import { fileURLToPath } from "node:url";
import { type } from "arktype";

const packageJsonSchema = type({
  name: "string",
  version: "string",
});

const twemojiPackage = module.findPackageJSON(
  "@discordapp/twemoji",
  import.meta.url,
);
if (!twemojiPackage) {
  throw new Error("Could not find @discordapp/twemoji package.");
}
const twemojiAssetsPath = path.join(
  path.dirname(twemojiPackage),
  "dist",
  "svg",
);

// get drop version
const dropVersion = getDropVersion();

// get git ref or supply during build
const commitHash =
  process.env.BUILD_GIT_REF ??
  execSync("git rev-parse --short HEAD").toString().trim();

console.log(`Drop ${dropVersion} #${commitHash}`);

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ["./drop-base"],
  // Module config from here down

  modules: [
    "vue3-carousel-nuxt",
    "nuxt-security", // "@nuxt/image",
    "@nuxt/fonts",
    "@nuxt/eslint",
    "@nuxtjs/i18n",
    "@vueuse/nuxt",
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

  sourcemap: {
    server: true,
    client: true,
  },

  experimental: {
    buildCache: true,
    viewTransition: false,
    appManifest: false,
    componentIslands: true,
  },

  // future: {
  //   compatibilityVersion: 4,
  // },

  vite: {
    plugins: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tailwindcss() as any,
    ],
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

    // redirect old OIDC callback route
    "/auth/callback/oidc": {
      redirect: "/api/v1/auth/oidc/callback",
    },
  },

  devServer: {
    port: 4000,
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

    serverAssets: [
      {
        baseName: "twemoji",
        // get path to twemoji svg assets
        dir: twemojiAssetsPath,
      },
    ],
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
    bundle: {
      optimizeTranslationDirective: false,
    },
    defaultLocale: "en-us",
    lazy: true,
    strategy: "no_prefix",
    experimental: {
      localeDetector: "localeDetector.ts",
      autoImportTranslationFunctions: true,
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "drop_i18n_redirected",
      fallbackLocale: "en-us",
    },
    locales: [
      { code: "en-us", language: "en-us", name: "English", file: "en_us.json" },
      {
        code: "en-gb",
        language: "en-gb",
        name: "English (UK)",
        file: "en_gb.json",
      },
      {
        code: "en-au",
        language: "en-au",
        name: "English (Australia)",
        file: "en_au.json",
      },
      {
        code: "en-pirate",
        language: "en-pirate",
        name: "English (Pirate)",
        file: "en_pirate.json",
      },
      {
        code: "fr",
        language: "fr",
        name: "French",
        file: "fr.json",
      },
      {
        code: "de",
        language: "de",
        name: "German",
        file: "de.json",
      },
      {
        code: "it",
        language: "it",
        name: "Italian",
        file: "it.json",
      },
      {
        code: "es",
        language: "es",
        name: "Spanish",
        file: "es.json",
      },
      {
        code: "zh",
        language: "zh",
        name: "Chinese",
        file: "zh.json",
      },
      {
        code: "zh-tw",
        language: "zh-tw",
        name: "Chinese (Taiwan)",
        file: "zh_tw.json",
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
          "https://*.steamstatic.com",
        ],
      },
      strictTransportSecurity: false,
    },
    rateLimiter: false,
    xssValidator: false,
    requestSizeLimiter: false,
  },
});

/**
 * Gets the drop version from the environment variable or package.json
 * @returns {string} The drop version
 */
function getDropVersion(): string {
  // get drop version from environment variable
  if (process.env.BUILD_DROP_VERSION) {
    return process.env.BUILD_DROP_VERSION;
  }
  // example nightly: "v0.3.0-nightly.2025.05.28"
  const defaultVersion = "v0.0.0-alpha.0";

  const packageJsonPath = fileURLToPath(import.meta.resolve("./package.json"));

  if (!existsSync(packageJsonPath)) {
    console.error("Could not find package.json, using default version.");
    return defaultVersion;
  }

  // parse package.json
  const raw = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const packageJson = packageJsonSchema(raw);
  if (packageJson instanceof type.errors) {
    console.error("Failed to parse package.json", packageJson.summary);
    return defaultVersion;
  }

  // ensure version starts with 'v'
  if (packageJson.version.startsWith("v")) {
    return packageJson.version;
  }
  return `v${packageJson.version}`;
}
