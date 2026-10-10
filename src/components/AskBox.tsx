"use client";
import { useState } from "react";
import { Icon } from "./icons";

export function AskBox({ loc, labels }: { loc: string; labels: { ph: string; fallback: string; ai: string; error: string } }) {
  const [q, setQ] = useState(""), [busy, setBusy] = useState(false), [a, setA] = useState<{ html: string; note: string } | null>(null);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true); setA({ html: "…", note: "" });
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, locale: loc }) });
      const j = await r.json();
      if (!r.ok) throw new Error();
      setA({ html: j.html, note: j.source === "ai" ? labels.ai : labels.fallback });
    } catch { setA({ html: labels.error, note: "" }); } finally { setBusy(false); }
  }
  return (
    <>
      <form className="ask fade d2" onSubmit={ask}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.ph} aria-label={labels.ph} maxLength={500} />
        <button aria-label="ask" disabled={busy}><Icon name="arrow" size={20} /></button>
      </form>
      <div className="answer" aria-live="polite">{a ? <><span dangerouslySetInnerHTML={{ __html: a.html }} />{a.note ? <span className="note">{a.note}</span> : null}</> : null}</div>
    </>
  );
}
