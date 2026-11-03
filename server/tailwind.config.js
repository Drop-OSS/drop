// Theme tokens, mirroring desktop/main/tailwind.config.js: the shared
// libraries/base components are tokenised (surface/ink/accent), so the web
// build must resolve those utilities too. Defaults live in assets/core.scss
// and hold the stock zinc/blue values, so the web app keeps its current
// look; theme *switching* is a desktop-only feature for now.
const ramp = (prefix, steps) =>
  Object.fromEntries(
    steps.map((s) => [s, `rgb(var(--gd-${prefix}-${s}) / <alpha-value>)`])
  );

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter"],
        display: ["Motiva Sans"],
      },
      colors: {
        zinc: {
          925: "#111112",
        },
        surface: ramp("surface", [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        ink: ramp("ink", [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        accent: ramp("accent", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
      },
    },
  },
};
