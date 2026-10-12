"use client";
// Querra Fleet: selector de limbă pentru mobil — pastilă „RO ▾” care deschide o foaie cu RO/EN/PL (ținte mari, pentru degetul mare).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

const LANGS = [["ro", "🇷🇴", "Română"], ["en", "🇬🇧", "English"], ["pl", "🇵🇱", "Polski"]] as const;
export function langHref(path: string, sp: URLSearchParams | null, l: string) { const q = new URLSearchParams(sp?.toString() ?? ""); q.set("lang", l); return `${path}?${q.toString()}`; }

export function LangPicker({ loc, title, inline }: { loc: string; title: string; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname(), sp = useSearchParams();
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); addEventListener("keydown", k); document.body.classList.add("sheet-open"); return () => { removeEventListener("keydown", k); document.body.classList.remove("sheet-open"); }; }, [open]);
  const list = (
    <div className="lp-list" role="listbox" aria-label={title}>
      {LANGS.map(([l, f, n]) => <a key={l} role="option" aria-selected={l === loc} className={l === loc ? "on" : ""} href={langHref(path, sp, l)}><span className="lp-flag" aria-hidden="true">{f}</span><span className="lp-name">{n}</span><span className="lp-code">{l.toUpperCase()}</span>{l === loc ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}</a>)}
    </div>
  );
  if (inline) return <div className="lp-inline"><div className="eyebrow">{title}</div>{list}</div>;
  return (
    <>
      <button type="button" className="lp-pill" aria-haspopup="listbox" aria-expanded={open} aria-label={title} onClick={() => setOpen(true)}>{loc.toUpperCase()}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></button>
      {open ? createPortal(
        <div className="lp-sheet" onClick={() => setOpen(false)}>
          <div className="lp-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lp-grab" />
            <div className="lp-title">{title}</div>
            {list}
          </div>
        </div>, document.body
      ) : null}
    </>
  );
}
