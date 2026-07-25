"use client";

import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Animates a number from its starting value to its target value when it enters the viewport.
 *
 * @param decimals - Number of decimal places to display.
 * @returns A motion element containing the animated, formatted number.
 */
export function AnimatedNumber({
  start,
  end,
  decimals = 0,
}: {
  readonly start: number;
  readonly end: number;
  readonly decimals?: number;
}) {
  let ref = useRef(null);
  let isInView = useInView(ref, { once: true, amount: 0.5 });

  let value = useMotionValue(start);
  let spring = useSpring(value, { damping: 30, stiffness: 100 });
  let display = useTransform(spring, (num) => num.toFixed(decimals));

  useEffect(() => {
    value.set(isInView ? end : start);
  }, [start, end, isInView, value]);

  return <motion.span ref={ref}>{display}</motion.span>;
}
