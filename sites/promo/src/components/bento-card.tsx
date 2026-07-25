"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { Subheading } from "./text";

/**
 * Renders a styled card with a graphic, heading content, description, and optional fade overlays.
 *
 * @param dark - Whether to render the card using dark styling.
 * @param fade - The edges of the graphic to overlay with gradients.
 * @returns A styled card element.
 */
export function BentoCard({
  dark = false,
  className = "",
  eyebrow,
  title,
  description,
  graphic,
  fade = [],
}: {
  readonly dark?: boolean;
  readonly className?: string;
  readonly eyebrow: React.ReactNode;
  readonly title: React.ReactNode;
  readonly description: React.ReactNode;
  readonly graphic: React.ReactNode;
  readonly fade?: ("top" | "bottom")[];
}) {
  return (
    <motion.div
      initial="idle"
      whileHover="active"
      variants={{ idle: {}, active: {} }}
      data-dark={dark ? "true" : undefined}
      className={clsx(
        className,
        "group relative flex flex-col overflow-hidden rounded-lg ring-1",
        "bg-zinc-900 ring-white/15",
      )}
    >
      <div className="relative h-80 shrink-0">
        {graphic}
        {fade.includes("top") && (
          <div className="absolute inset-0 bg-linear-to-b from-zinc-900 to-50%" />
        )}
        {fade.includes("bottom") && (
          <div className="absolute inset-0 bg-linear-to-t from-zinc-900 to-50%" />
        )}
      </div>
      <div className="relative p-10">
        <Subheading as="h3" dark={dark}>
          {eyebrow}
        </Subheading>
        <p className="mt-1 text-2xl/8 font-medium tracking-tight text-white">{title}</p>
        <p className="mt-2 max-w-[600px] text-sm/6 text-gray-400">{description}</p>
      </div>
    </motion.div>
  );
}
