"use client";
// Închide meniul contului la navigare și la orice acțiune din el (link, buton), plus clic în afară.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { closeMenus } from "./DemoTour";
export function MenuCloser() {
  const path = usePathname(), sp = useSearchParams();
  useEffect(() => { closeMenus(); }, [path, sp]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null, acct = document.querySelector("details.acct[open]");
      if (!acct || !el) return;
      if (!acct.contains(el)) { closeMenus(); return; }
      if (el.closest(".menu a, .menu button:not(.switch)")) setTimeout(closeMenus, 0);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenus(); };
    addEventListener("click", onClick); addEventListener("keydown", onKey);
    return () => { removeEventListener("click", onClick); removeEventListener("keydown", onKey); };
  }, []);
  return null;
}
