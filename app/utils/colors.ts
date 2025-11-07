export const CHART_COLOURS = {
  // Bar colours
  red: {
    fill: "fill-red-700",
    bg: "bg-red-700",
  },
  orange: {
    fill: "fill-orange-800",
    bg: "bg-orange-800",
  },
  blue: {
    fill: "fill-blue-900",
    bg: "bg-blue-900",
  },

  // Pie colours
  lightblue: {
    fill: "fill-blue-400",
    bg: "bg-blue-400",
  },
  dropblue: {
    fill: "fill-blue-600",
    bg: "bg-blue-600",
  },
  green: {
    fill: "fill-green-500",
    bg: "bg-green-500",
  },
  yellow: {
    fill: "fill-yellow-800",
    bg: "bg-yellow-800",
  },
  purple: {
    fill: "fill-purple-500",
    bg: "bg-purple-500",
  },
  zinc: {
    fill: "fill-zinc-950",
    bg: "bg-zinc-950",
  },
  pink: {
    fill: "fill-pink-800",
    bg: "bg-pink-800",
  },

  lime: {
    fill: "fill-lime-600",
    bg: "bg-lime-600",
  },
  emerald: {
    fill: "fill-emerald-500",
    bg: "bg-emerald-500",
  },
  slate: {
    fill: "fill-slate-800",
    bg: "bg-slate-800",
  },
};
export const PIE_COLOURS: ChartColour[] = [
  "lightblue",
  "dropblue",
  "purple",
  "emerald",
];

export type ChartColour = keyof typeof CHART_COLOURS;

export function getBarColor(percentage: number): ChartColour {
  if (percentage <= 70) {
    return "blue";
  }
  if (percentage > 70 && percentage <= 90) {
    return "orange";
  }
  return "red";
}
