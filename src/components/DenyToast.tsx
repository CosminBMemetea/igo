"use client";
import { useEffect, useState } from "react";
/** Mesajul „rol greșit”: dispare singur după ~5 s, se poate închide, nu blochează conținutul (pointer-events doar pe el). */
export function DenyToast({ text, close }: { text: string; close: string }) {
  const [st, setSt] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    // scoatem ?denied= din URL ca reîncărcarea să nu-l repete
    try { const u = new URL(location.href); if (u.searchParams.has("denied")) { u.searchParams.delete("denied"); history.replaceState(history.state, "", u.pathname + (u.search || "") + u.hash); } } catch {}
    const a = setTimeout(() => setSt("out"), 5000), b = setTimeout(() => setSt("gone"), 5400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (st === "gone") return null;
  return (
    <div className={`rolebar r-deny dtoast${st === "out" ? " out" : ""}`} role="status" aria-live="polite">
      <span>{text}</span>
      <button type="button" className="dx" aria-label={close} onClick={() => { setSt("out"); setTimeout(() => setSt("gone"), 300); }}>×</button>
    </div>
  );
}
