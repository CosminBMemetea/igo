"use client";
// Rezolvarea unei avertizări direct din card (flux + /alerts). Demo: starea stă în cookie-ul sesiunii demo (POST /api/feed/resolve).
import { useEffect, useRef, useState } from "react";
import type { FeedText } from "@/lib/feed-i18n";

export type RKind = "theft" | "doc" | "idle";
export type RAction = "confirm" | "false" | "upload" | "ok";
export interface RState { a: RAction; n?: string }
const DONE: Record<RAction, keyof FeedText> = { confirm: "dConfirm", false: "dFalse", upload: "dUpload", ok: "dOk" };

/** micșorează poza documentului și o ține în localStorage (ca la bonuri) */
function thumb(file: File, key: string): Promise<void> {
  return new Promise((ok) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { try { const s = 160 / Math.max(img.width, img.height), c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s; c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); localStorage.setItem(key, c.toDataURL("image/jpeg", 0.7)); } catch {} URL.revokeObjectURL(url); ok(); };
    img.onerror = () => { URL.revokeObjectURL(url); ok(); };
    img.src = url;
  });
}

export function Resolve({ id, kind, F, init, tel, onChange }: { id: string; kind: RKind; F: FeedText; init?: RState | null; tel?: { href: string; label: string; note?: string }; onChange?: (id: string, r: RState | null) => void }) {
  const [r, setR] = useState<RState | null>(init ?? null), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [img, setImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null), tk = `qf-thumb-res-${id}`;
  useEffect(() => { if (r?.a === "upload") setImg(localStorage.getItem(tk)); }, [r, tk]);
  const send = async (a: RAction | null, n?: string) => {
    setBusy(true);
    const ok = await fetch("/api/feed/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: a, note: n }) }).then((x) => x.ok).catch(() => false);
    setBusy(false); if (!ok) return;
    const nr = a ? { a, ...(n ? { n } : {}) } : null;
    if (navigator.vibrate) navigator.vibrate(a ? [10, 40, 10] : 8);
    setR(nr); onChange?.(id, nr);
  };
  if (r) return (
    <div className="rsv done" data-res={r.a}>
      <span className="rck" aria-hidden="true">✓</span>
      <div><b>{F[DONE[r.a]] as string}</b>{r.n ? <small>{r.n}</small> : null}</div>
      {img ? <img src={img} alt="" className="rimg" /> : null}
      <button type="button" className="link rundo" disabled={busy} onClick={() => send(null)}>{F.rUndo}</button>
    </div>
  );
  return (
    <div className="rsv">
      {kind === "theft" ? <>
        <textarea className="rnote" rows={1} maxLength={140} placeholder={F.rNote} value={note} onChange={(e) => setNote(e.target.value)} aria-label={F.rNote} />
        <div className="rbtns">
          <button type="button" className="btn sm rbad" disabled={busy} onClick={() => send("confirm", note)}>{F.rConfirm}</button>
          <button type="button" className="btn sec sm" disabled={busy} onClick={() => send("false", note)}>{F.rFalse}</button>
        </div>
      </> : kind === "doc" ? <div className="rbtns">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.type.startsWith("image/")) await thumb(f, tk); send("upload", f.name.slice(0, 60)); }} />
        <button type="button" className="btn sm" disabled={busy} onClick={() => fileRef.current?.click()}>📷 {F.rUpload}</button>
      </div> : <div className="rbtns">
        {tel ? <a className="btn sm fcall" href={tel.href} title={tel.note}>📞 {tel.label}</a> : null}
        <button type="button" className="btn sec sm" disabled={busy} onClick={() => send("ok")}>{F.rOk}</button>
      </div>}
    </div>
  );
}
