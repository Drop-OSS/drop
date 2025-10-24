export const COLORS = {
  red: {
    fill: "fill-red-800",
    bg: "bg-red-800",
  },
  blue: {
    fill: "fill-blue-800",
    bg: "bg-blue-800",
  },
  green: {
    fill: "fill-green-800",
    bg: "bg-green-800",
  },
  yellow: {
    fill: "fill-yellow-800",
    bg: "bg-yellow-800",
  },
  purple: {
    fill: "fill-purple-800",
    bg: "bg-purple-800",
  },
  zinc: {
    fill: "fill-zinc-800",
    bg: "bg-zinc-800",
  },
  pink: {
    fill: "fill-pink-800",
    bg: "bg-pink-800",
  },
  orange: {
    fill: "fill-orange-800",
    bg: "bg-orange-800",
  },
  lime: {
    fill: "fill-lime-800",
    bg: "bg-lime-800",
  },
  emerald: {
    fill: "fill-emerald-800",
    bg: "bg-emerald-800",
  },
  slate: {
    fill: "fill-slate-400",
    bg: "bg-slate-400",
  },
};

export type COLOR = keyof typeof COLORS;

export function getColor(percentage: number) {
  if (percentage <= 70) {
    return "blue";
  }
  if (percentage > 70 && percentage <= 90) {
    return "orange";
  }
  return "red";
}
