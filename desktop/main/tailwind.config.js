const path = require('path');

const dropbase = path.join(__dirname, "../../libraries/base")

// Theme tokens: every colour utility resolves to an rgb(var(--gd-*) / alpha)
// triple, so a theme is just a new set of channel values on :root. The
// defaults live in assets/main.scss and hold the original Tailwind zinc/blue
// values verbatim, which makes the tokenised palette pixel-identical until a
// theme actually changes a variable.
const ramp = (prefix, steps) =>
  Object.fromEntries(
    steps.map((s) => [s, `rgb(var(--gd-${prefix}-${s}) / <alpha-value>)`])
  );

export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
    `${dropbase}/components/**/*.{js,vue,ts}`,
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter"],
        display: ["Motiva Sans"],
      },
      colors: {
        // Surfaces (backgrounds, borders, rings): the old zinc scale.
        surface: ramp("surface", [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        // Text tones: the same scale under an ink name (text-ink-400 reads
        // better than text-surface-400 and can diverge per theme).
        ink: ramp("ink", [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        // Accent: the old blue scale.
        accent: ramp("accent", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
