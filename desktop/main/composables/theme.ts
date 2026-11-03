import { invoke } from "@tauri-apps/api/core";

/**
 * Live theming. The app's colours all resolve through the `--gd-*` channel
 * variables (assets/main.scss); a theme is just a different set of values for
 * them, applied straight onto the document root. Keys and defaults match the
 * Rust `ThemeSettings`, and the "zinc + blue" combination reproduces the
 * original palette exactly, so nothing changes until the user picks.
 *
 * The ramps are the Tailwind colour scales; status colours (red/green/…)
 * deliberately stay outside the system.
 */

const SURFACE_STEPS = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;
const ACCENT_STEPS = [300, 400, 500, 600, 700, 800, 900] as const;

type Ramp<T extends readonly number[]> = Record<T[number], string>;

const SURFACES = {
  zinc: {
    100: "#f4f4f5",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#18181b",
    950: "#09090b",
  } as Ramp<typeof SURFACE_STEPS>,
  slate: {
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  } as Ramp<typeof SURFACE_STEPS>,
  stone: {
    100: "#fafaf9",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    800: "#292524",
    900: "#1c1917",
    950: "#0c0a09",
  } as Ramp<typeof SURFACE_STEPS>,
  neutral: {
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  } as Ramp<typeof SURFACE_STEPS>,
};

const ACCENTS = {
  blue: {
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  } as Ramp<typeof ACCENT_STEPS>,
  violet: {
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
  } as Ramp<typeof ACCENT_STEPS>,
  pink: {
    300: "#f9a8d4",
    400: "#f472b6",
    500: "#ec4899",
    600: "#db2777",
    700: "#be185d",
    800: "#9d174d",
    900: "#831843",
  } as Ramp<typeof ACCENT_STEPS>,
  cyan: {
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
  } as Ramp<typeof ACCENT_STEPS>,
  emerald: {
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  } as Ramp<typeof ACCENT_STEPS>,
  amber: {
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  } as Ramp<typeof ACCENT_STEPS>,
  rose: {
    300: "#fda4af",
    400: "#fb7185",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    800: "#9f1239",
    900: "#881337",
  } as Ramp<typeof ACCENT_STEPS>,
};

export type SurfaceKey = keyof typeof SURFACES;
export type AccentKey = keyof typeof ACCENTS;

export interface ThemeChoice {
  accent: string;
  surface: string;
}

/** Keys the picker renders, in display order. Unknown stored keys are kept
 * (they simply render as "custom" = unselected) instead of being clobbered. */
export const SURFACE_KEYS = Object.keys(SURFACES) as SurfaceKey[];
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

/** Representative colour per option, for the picker's swatches. */
const step = (ramp: object, n: number): string =>
  // Every ramp carries every documented step; the cast is just to index it.
  (ramp as Record<number, string>)[n]!;
export const swatch = {
  accent: (key: string) => step(ACCENTS[key as AccentKey] ?? ACCENTS.blue, 600),
  surface: (key: string) =>
    step(SURFACES[key as SurfaceKey] ?? SURFACES.zinc, 800),
};

/** "#2563eb" -> "37 99 235", the channel-triple form the variables hold. */
const toChannels = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export const useTheme = () => {
  // useState lives INSIDE the composable: auto-imported modules are evaluated
  // before a Nuxt instance exists, so a module-scope call throws NUXT_E1001.
  const theme = useState<ThemeChoice>("theme", () => ({
    accent: "blue",
    surface: "zinc",
  }));

  /** Write the chosen ramps onto the document root. Unknown keys fall back
   * to the defaults, which are the values :root already carries. */
  const apply = (choice: ThemeChoice) => {
    theme.value = choice;
    if (!import.meta.client) return;
    const root = document.documentElement.style;
    const surface = SURFACES[choice.surface as SurfaceKey] ?? SURFACES.zinc;
    for (const step of SURFACE_STEPS) {
      root.setProperty(`--gd-surface-${step}`, toChannels(surface[step]));
      // Text tones ride the same hue ramp; contrast steps are shared.
      root.setProperty(`--gd-ink-${step}`, toChannels(surface[step]));
    }
    const accent = ACCENTS[choice.accent as AccentKey] ?? ACCENTS.blue;
    for (const step of ACCENT_STEPS) {
      root.setProperty(`--gd-accent-${step}`, toChannels(accent[step]));
    }
  };

  /** Load the stored choice once (app startup). */
  const init = async () => {
    try {
      const settings = await invoke<{ theme?: ThemeChoice }>("fetch_settings");
      if (settings.theme) apply(settings.theme);
    } catch (e) {
      console.warn("theme load failed, keeping defaults:", e);
    }
  };

  /** Pick one axis and persist; `update_settings` merges top-level keys, so
   * the whole theme object goes over each time. */
  const set = async (axis: keyof ThemeChoice, key: string) => {
    const choice = { ...theme.value, [axis]: key };
    apply(choice);
    await invoke("update_settings", { newSettings: { theme: choice } });
  };

  return { theme, apply, init, set };
};
