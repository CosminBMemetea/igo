"use client";
// Piese comune pentru fluxul flotei: indicator live, filtre (tip + camion), acțiuni rapide.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedUI } from "@/lib/feed-ui-i18n";

const fillS = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** „Live · actualizat acum X s” — montat cu key={stamp}, deci repornește la fiecare randare nouă de pe server. */
function LiveNowInner({ U }: { U: FeedUI }) {
  const at = useRef(0), [s, setS] = useState(0);
  useEffect(() => { at.current = Date.now(); const i = setInterval(() => setS(Math.round((Date.now() - at.current) / 1000)), 5000); return () => clearInterval(i); }, []);
  const when = s < 10 ? U.justNow : s < 60 ? fillS(U.secAgo, { n: s }) : fillS(U.minAgo, { n: Math.floor(s / 60) });
  return <div className="fnow tick" role="status"><span className="flive" /><b>{U.liveNow}</b><span>{fillS(U.upd, { s: when })}</span></div>;
}
export function LiveNow({ U, stamp }: { U: FeedUI; stamp: string | number }) { return <LiveNowInner key={String(stamp)} U={U} />; }

export interface Chip { id: string; label: string; n: number }
export function FeedChips({ U, kinds, kind, setKind, trucks, truck, setTruck }: { U: FeedUI; kinds: Chip[]; kind: string; setKind: (k: string) => void; trucks: { id: string; label: string }[]; truck: string; setTruck: (t: string) => void }) {
  return (
    <div className="fchips" role="toolbar" aria-label={U.filters}>
      <div className="fchrow">
        {kinds.filter((c) => c.id === "all" || c.n > 0).map((c) => (
          <button key={c.id} type="button" className={`fchip${kind === c.id ? " on" : ""}`} aria-pressed={kind === c.id} onClick={() => setKind(c.id)}>{c.label}{c.id !== "all" ? <small>{c.n}</small> : null}</button>
        ))}
      </div>
      {trucks.length > 1 ? (
        <label className="fchtruck"><span className="vh">{U.trucks}</span>
          <select value={truck} onChange={(e) => setTruck(e.target.value)} aria-label={U.trucks}>
            <option value="">{U.allTrucks}</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function QuickActions({ U, truckId, day }: { U: FeedUI; truckId: string; day: string }) {
  const v = encodeURIComponent(truckId);
  return (
    <div className="fqa">
      <Link className="btn sec sm" href={`/live?v=${v}`}>📍 {U.map}</Link>
      <Link className="btn sec sm" href={`/replay?v=${v}&d=${day}`}>▶ {U.replay}</Link>
      <Link className="btn sec sm" href={`/trips?truck=${v}`}>🧾 {U.trip}</Link>
    </div>
  );
}

export function FeedEmpty({ U, onReset }: { U: FeedUI; onReset: () => void }) {
  return <div className="fempty"><span aria-hidden>🔍</span><p>{U.none}</p><button type="button" className="btn sec sm" onClick={onReset}>{U.reset}</button></div>;
}
