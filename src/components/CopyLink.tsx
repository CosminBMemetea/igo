"use client";
import { useState } from "react";
export function CopyLink({ url, copy, copied, wa, waLabel }: { url: string; copy: string; copied: string; wa: string | null; waLabel: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="copy">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="link" />
      <button type="button" className="btn sec" onClick={async () => { try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* selectare manuală */ } }}>{ok ? copied : copy}</button>
      {wa ? <a className="btn sec" href={wa} target="_blank" rel="noreferrer">{waLabel}</a> : null}
    </div>
  );
}
