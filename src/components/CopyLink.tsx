"use client";
import { useRef, useState } from "react";
export function CopyLink({ url, copy, copied, wa, waLabel, sms, smsLabel }: { url: string; copy: string; copied: string; wa: string | null; waLabel: string; sms?: string; smsLabel?: string }) {
  const [ok, setOk] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="copy">
      <input ref={input} readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="link" />
      <button type="button" className="btn sec" onClick={async () => { try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2000); } catch { input.current?.focus(); input.current?.select(); } }}>{ok ? copied : copy}</button>
      {wa ? <a className="btn sec" href={wa} target="_blank" rel="noreferrer">{waLabel}</a> : null}
      {sms ? <a className="btn sec" href={sms}>{smsLabel}</a> : null}
    </div>
  );
}
