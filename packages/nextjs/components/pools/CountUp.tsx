"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up to a number once when it appears, and eases to new values later. Skips the motion if the visitor prefers. */
export const CountUp = ({
  value,
  format,
  duration = 1200,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) => {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const base = from.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min((now - start) / duration, 1);
      const v = base + (value - base) * (1 - Math.pow(1 - t, 3));
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(shown)}</>;
};
