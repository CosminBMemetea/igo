"use client";
import type { ReactNode } from "react";
/** Resolve against the current URL at click time, including filters and fragment. */
export function ThemeLink({ theme, className, label, children }: { theme: "light" | "dark"; className: string; label: string; children: ReactNode }) {
  return <button type="button" className={className} aria-label={label} onClick={() => {
    const url = new URL(window.location.href);
    url.searchParams.set("theme", theme);
    window.location.assign(url.href);
  }}>{children}</button>;
}
