"use client";
// „Mărime butoane”: L / XL / XXL, ținută pe dispozitiv (localStorage) → <html data-bsize>.
import { useEffect, useState } from "react";
export const BSIZE_KEY = "qf-bsize";
type S = "n" | "l" | "xl";
export function BtnSize({ label, opts }: { label: string; opts: [string, string, string] }) {
  const [v, setV] = useState<S>("n");
  useEffect(() => { try { const s = localStorage.getItem(BSIZE_KEY); if (s === "l" || s === "xl") setV(s); } catch { /* Browser storage may be unavailable. */ } }, []);
  const pick = (s: S) => { setV(s); try { localStorage.setItem(BSIZE_KEY, s); } catch {} if (s === "n") delete document.documentElement.dataset.bsize; else document.documentElement.dataset.bsize = s; };
  return (
    <div className="bsize" role="group" aria-label={label}>
      <div className="eyebrow">{label}</div>
      <div className="seg">{(["n", "l", "xl"] as const).map((s, i) => <button key={s} type="button" className={v === s ? "on" : ""} aria-pressed={v === s} onClick={() => pick(s)}>{opts[i]}</button>)}</div>
    </div>
  );
}
/** se rulează înainte de randare, ca să nu „sară” bara la încărcare */
export const BSIZE_BOOT = `try{var s=localStorage.getItem("${BSIZE_KEY}");if(s==="l"||s==="xl")document.documentElement.dataset.bsize=s}catch(e){}`;
