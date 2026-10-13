"use client";
import { useEffect } from "react";
/** Derulare orizontală cu trackpad-ul (deltaX) în listele late, KPI și povești — fără să blocăm derularea verticală. */
const SEL = ".hsx, main>.hero, .fstories";
export function WheelX() {
  useEffect(() => {
    const h = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>(SEL);
      if (!el || el.scrollWidth <= el.clientWidth + 1) return;
      const max = el.scrollWidth - el.clientWidth, next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaX));
      if (next === el.scrollLeft) return;
      el.scrollLeft = next; e.preventDefault(); // altfel browserul ar face „înapoi/înainte” la swipe orizontal
    };
    addEventListener("wheel", h, { passive: false });
    return () => removeEventListener("wheel", h);
  }, []);
  return null;
}
