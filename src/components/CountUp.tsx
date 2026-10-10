"use client";
import { useEffect, useState } from "react";
import { fmtNum, type Locale } from "@/lib/i18n";

/** Număr care „urcă” la încărcare. Serverul randează valoarea finală (fără flicker la SSR). */
export function CountUp({ value, loc, d = 0 }: { value: number; loc: Locale; d?: number }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const f = (now: number) => { const p = Math.min(1, (now - t0) / 1400); setV(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{fmtNum(loc, v, d)}</span>;
}
