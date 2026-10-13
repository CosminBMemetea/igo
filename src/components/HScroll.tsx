"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
/** Pe mobil: tabelele/listele late se derulează orizontal (nu se taie). Fade la margini + indiciu „glisează” până la prima derulare. */
export function HScroll({ children, hint, min = 640, className = "" }: { children: ReactNode; hint: string; min?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null), [st, setSt] = useState({ l: false, r: false, used: false });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const up = () => setSt((s) => ({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4, used: s.used || el.scrollLeft > 4 }));
    up(); el.addEventListener("scroll", up, { passive: true }); window.addEventListener("resize", up);
    return () => { el.removeEventListener("scroll", up); window.removeEventListener("resize", up); };
  }, []);
  return (
    <div className={`hsw${st.l ? " fl" : ""}${st.r ? " fr" : ""} ${className}`}>
      {st.r && !st.used ? <span className="hshint" aria-hidden="true">{hint} →</span> : null}
      <div ref={ref} className="hsx" style={{ ["--hsmin" as string]: `${min}px` }}>{children}</div>
    </div>
  );
}
