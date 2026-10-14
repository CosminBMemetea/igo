"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Reîncarcă datele serverului periodic (doar cu tab-ul vizibil) și la revenirea în aplicație — harta live / fluxul patronului. */
export function AutoRefresh({ ms = 30000 }: { ms?: number }) {
  const r = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") r.refresh(); };
    const i = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(i); document.removeEventListener("visibilitychange", tick); };
  }, [r, ms]);
  return null;
}
