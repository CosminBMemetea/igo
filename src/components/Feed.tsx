"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedEvent, MiniMap, Story } from "@/lib/feed";
import type { FeedText } from "@/lib/feed-i18n";
import { Resolve, type RKind, type RState } from "./Resolve";
import type { FeedUI } from "@/lib/feed-ui-i18n";
import { FeedChips, FeedEmpty, LiveNow, QuickActions } from "./FeedBits";

const KGROUP: Record<FeedEvent["kind"], "alerts" | "road" | "fuel" | "praise"> = { theft: "alerts", doc: "alerts", idle: "alerts", border: "road", delivered: "road", group: "road", ontime: "road", fuel: "fuel", eco: "praise", rank: "praise" };

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const ICON: Record<FeedEvent["kind"], string> = { border: "🛂", fuel: "⛽", idle: "⏸", delivered: "📦", group: "📦", doc: "📄", theft: "⚠", eco: "🍃", rank: "🏆", ontime: "⏱" };
const ST_COL: Record<string, string> = { moving: "var(--pos)", working: "var(--acc)", pump: "#f5a524", stopped: "var(--fg3)", offline: "var(--fg3)", private: "#a78bfa" };

export function Avatar({ hue, initials, size = 36, ring }: { hue: number; initials: string; size?: number; ring?: string }) {
  return <span className="fav" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg,hsl(${hue} 62% 52%),hsl(${(hue + 40) % 360} 70% 40%))`, boxShadow: ring ? `0 0 0 2px var(--bg),0 0 0 4.5px ${ring}` : undefined }}>{initials}</span>;
}
export function Mini({ m, live, draw = 1.4 }: { m: MiniMap; live?: boolean; draw?: number }) {
  return (
    <svg className="fmap" viewBox={`0 0 ${m.w} ${m.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ ["--dr" as string]: `${draw}s` }}>
      <path d={m.full} className="r0" />
      <path d={m.done} className="r1" pathLength={1} />
      <circle cx={m.dot[0]} cy={m.dot[1]} r="9" className={`pulse${live ? " on" : ""}`} />
      <circle cx={m.dot[0]} cy={m.dot[1]} r="4.5" className="dot" />
    </svg>
  );
}
function ago(F: FeedText, nowMin: number, e: FeedEvent) {
  if (e.min == null) return e.when ?? "";
  const d = Math.max(0, Math.round(nowMin - e.min));
  return d < 1 ? F.now : d < 60 ? fill(F.ago, { n: d }) : fill(F.agoH, { h: Math.floor(d / 60) });
}

const RES_KIND: Partial<Record<FeedEvent["kind"], RKind>> = { theft: "theft", doc: "doc", idle: "idle" };
function Card({ e, F, nowMin, clapped, onClap, fresh, res, onRes, U, day, open, onToggle }: { U?: FeedUI; day?: string; open?: boolean; onToggle?: (id: string) => void; e: FeedEvent; F: FeedText; nowMin: number; clapped: boolean; onClap: (e: FeedEvent) => void; fresh?: boolean; res?: RState | null; onRes?: (id: string, r: RState | null) => void }) {
  const rk = onRes ? RES_KIND[e.kind] : undefined;
  const ref = useRef<HTMLElement>(null), [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([x]) => { if (x.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  const live = e.min != null && nowMin - e.min < 45 && (e.kind === "border" || e.kind === "idle" || e.kind === "fuel");
  return (
    <article ref={ref} className={`fcard k-${e.kind} p-${e.prio}${seen ? " in" : ""}${fresh ? " fresh" : ""}${res ? " is-res" : ""}${open ? " open" : ""}`} id={e.id}
      onClick={onToggle ? (ev) => { if (!(ev.target as HTMLElement).closest("a,button,input,select,textarea,label,summary,details")) onToggle(e.id); } : undefined}>
      <header>
        <Avatar hue={e.hue} initials={e.initials} />
        <div className="who"><b>{e.driver}</b><span>{e.plate} · <time suppressHydrationWarning>{ago(F, nowMin, e)}</time></span></div>
        <span className="kic" aria-hidden="true">{e.flag ?? ICON[e.kind]}</span>
        {onToggle && U ? <button type="button" className="fexp" aria-expanded={!!open} aria-label={open ? U.less : U.more} onClick={() => onToggle(e.id)}>⌄</button> : null}
      </header>
      <h3>{e.title}</h3>
      <p>{e.sub}</p>
      {e.plates ? <div className="fplates">{e.plates.map((p) => <span key={p}>{p}</span>)}</div> : null}
      {e.map || e.receipt ? (
        <div className={`fmedia${e.receipt ? " has-rc" : ""}`}>
          {e.map ? <Mini m={e.map} live={live} /> : null}
          {e.receipt ? (
            <div className="frc" aria-label={e.receipt.station}>
              <b>{e.receipt.station}</b><span>{e.receipt.time}</span><i />
              <div><span>{e.receipt.litres}</span><b>{e.receipt.lei}</b></div>
              {e.receipt.orig ? <small>{e.receipt.orig}</small> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {open && U && day ? <QuickActions U={U} truckId={e.vehicleId} day={day} /> : null}
      {rk ? <Resolve id={e.id} kind={rk} F={F} init={res} tel={e.cta?.tel ? e.cta : undefined} onChange={onRes} /> : e.cta || e.clap ? (
        <footer>
          {e.cta ? (e.cta.tel ? <a className="btn sec sm fcall" href={e.cta.href} title={e.cta.note}>📞 {e.cta.label}</a> : <Link className="btn sec sm" href={e.cta.href}>{e.cta.label} →</Link>) : null}
          {e.clap ? <button type="button" className={`fclap${clapped ? " on" : ""}`} aria-pressed={clapped} onClick={() => onClap(e)}><span className="em">👏</span>{clapped ? F.clapped : F.clap}</button> : null}
        </footer>
      ) : null}
    </article>
  );
}

function StoryView({ stories, start, F, onClose }: { stories: Story[]; start: number; F: FeedText; onClose: () => void }) {
  const [i, setI] = useState(start), [p, setP] = useState(0), paused = useRef(false), tx = useRef<number | null>(null);
  const s = stories[i], DUR = 3000;
  const go = useCallback((d: number) => { setP(0); setI((x) => { const n = x + d; if (n < 0) return 0; if (n >= stories.length) { onClose(); return x; } return n; }); }, [stories.length, onClose]);
  useEffect(() => {
    let last = performance.now(), raf = 0;
    const tick = (now: number) => { const dt = (now - last) / DUR; last = now; if (!paused.current) setP((v) => { const nv = v + dt; if (nv >= 1) { go(1); return 0; } return nv; }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [i, go]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }; addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, [go, onClose]);
  if (!s) return null;
  const shown = Math.ceil(p * (s.stops.length + 1.5));
  return (
    <div className="story" role="dialog" aria-modal="true" aria-label={fill(F.story, { name: s.driver })}
      onPointerDown={() => { paused.current = true; }} onPointerUp={() => { paused.current = false; }} onPointerLeave={() => { paused.current = false; }}
      onTouchStart={(e) => { tx.current = e.touches[0].clientX; }} onTouchEnd={(e) => { const s0 = tx.current; tx.current = null; if (s0 == null) return; const dx = e.changedTouches[0].clientX - s0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
      <div className="sbox" key={s.vehicleId}>
        <div className="sbars">{stories.map((x, k) => <i key={x.vehicleId}><b style={{ width: `${k < i ? 100 : k === i ? p * 100 : 0}%` }} /></i>)}</div>
        <div className="shead"><Avatar hue={s.hue} initials={s.initials} size={38} ring={ST_COL[s.status]} /><div><b>{s.driver}</b><span>{s.plate} · {fill(F.storyKm, { km: s.km })}{s.priv ? "" : ` · ${s.rate}`}</span></div><button type="button" className="sx" aria-label={F.close} onClick={(e) => { e.stopPropagation(); onClose(); }} onPointerDown={(e) => e.stopPropagation()}>×</button></div>
        {s.priv ? <div className="spriv">🔒 {F.storyPriv}</div> : s.map ? <div className="smap"><Mini m={s.map} live draw={3.8} /></div> : <div className="spriv">{F.storyNone}</div>}
        {!s.priv && s.stops.length ? (
          <ol className="sstops">{s.stops.map((x, k) => <li key={k} className={k < shown ? "on" : ""}><time>{x.time}</time><b>{F.st[x.kind]}</b><span>{x.place}</span></li>)}</ol>
        ) : null}
        {s.fill && shown > s.stops.length ? <div className="frc sfill"><b>{s.fill.station}</b><span>{s.fill.time}</span><i /><div><span>{s.fill.litres}</span><b>{s.fill.lei}</b></div>{s.fill.orig ? <small>{s.fill.orig}</small> : null}</div> : null}
        <button type="button" className="snav l" aria-label="‹" onClick={(e) => { e.stopPropagation(); go(-1); }} />
        <button type="button" className="snav r" aria-label="›" onClick={(e) => { e.stopPropagation(); go(1); }} />
      </div>
    </div>
  );
}

export interface FeedData { pinned: FeedEvent[]; events: FeedEvent[]; queue: FeedEvent[]; stories: Story[]; now: number }
export function Feed({ data, F, reacted, demo, resolved = {}, U, day, stamp = "" }: { U: FeedUI; day: string; stamp?: string; data: FeedData; F: FeedText; reacted: string[]; demo: boolean; resolved?: Record<string, RState> }) {
  const [res, setRes] = useState<Record<string, RState>>(resolved);
  const onRes = (id: string, r: RState | null) => setRes((m) => { const n = { ...m }; if (r) n[id] = r; else delete n[id]; return n; });
  const [events, setEvents] = useState(data.events), [queue, setQueue] = useState(data.queue), [fresh, setFresh] = useState<Set<string>>(new Set());
  const [claps, setClaps] = useState(new Set(reacted)), [toast, setToast] = useState(""), [story, setStory] = useState<number | null>(null), [unseen, setUnseen] = useState(0);
  const t0 = useRef(0), [nowMin, setNowMin] = useState(data.now);
  const [pull, setPull] = useState(0), [busy, setBusy] = useState(false), y0 = useRef<number | null>(null);
  useEffect(() => { t0.current = Date.now(); const i = setInterval(() => setNowMin(data.now + (Date.now() - t0.current) / 60000), 20000); return () => clearInterval(i); }, [data.now]);
  const qRef = useRef(data.queue);
  const [kind, setKind] = useState("all"), [truck, setTruck] = useState(""), [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback((id: string) => setOpenId((x) => (x === id ? null : id)), []);
  // reîmprospătarea de 15 s aduce props noi: evenimentele necunoscute intră sus, animat
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setEvents((prev) => { const have = new Set(prev.map((x) => x.id)), add = data.events.filter((x) => !have.has(x.id)); if (!add.length) return prev; setFresh((f) => { const n = new Set(f); add.forEach((x) => n.add(x.id)); return n; }); return [...add, ...prev]; });
  }, [data.events]);
  const release = useCallback((): boolean => {
    const q = qRef.current; if (!q.length) return false;
    const [e, ...rest] = q, at = data.now + (Date.now() - (t0.current || Date.now())) / 60000;
    qRef.current = rest; setQueue(rest);
    setEvents((xs) => [{ ...e, min: at }, ...xs]);
    setFresh((s) => new Set(s).add(e.id));
    if (window.scrollY > 380) setUnseen((n) => n + 1);
    return true;
  }, [data.now]);
  // demo: un eveniment nou la fiecare ~20–40 s (din ce urmează pe traseu)
  useEffect(() => {
    if (!demo || !queue.length) return;
    const id = setTimeout(release, 20000 + Math.random() * 20000);
    return () => clearTimeout(id);
  }, [demo, queue.length, release]);
  useEffect(() => { const s = () => { if (window.scrollY < 200) setUnseen(0); }; addEventListener("scroll", s, { passive: true }); return () => removeEventListener("scroll", s); }, []);
  useEffect(() => { if (!toast) return; const i = setTimeout(() => setToast(""), 2600); return () => clearTimeout(i); }, [toast]);
  const clap = async (e: FeedEvent) => {
    const on = !claps.has(e.id), n = new Set(claps); if (on) n.add(e.id); else n.delete(e.id); setClaps(n);
    if (on) setToast(fill(F.clapSent, { driver: e.driver.split(" ")[0] }));
    if (navigator.vibrate) navigator.vibrate(12);
    await fetch("/api/feed/react", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: e.id, vehicleId: e.vehicleId, label: e.title, on }) }).catch(() => null);
  };
  // avertizări: furt + documente + opriri lungi; rezolvatele coboară într-o secțiune pliată
  const attn = [...data.pinned, ...events.filter((e) => e.kind === "idle")], open = attn.filter((e) => !res[e.id]), done = attn.filter((e) => res[e.id]);
  const match = (e: FeedEvent) => (kind === "all" || KGROUP[e.kind] === kind) && (!truck || e.vehicleId === truck);
  const allEv = [...data.pinned, ...events];
  const counts = { alerts: 0, road: 0, fuel: 0, praise: 0 }; for (const e of allEv) if (!truck || e.vehicleId === truck) counts[KGROUP[e.kind]]++;
  const kinds = [{ id: "all", label: U.all, n: 0 }, { id: "alerts", label: U.alerts, n: counts.alerts }, { id: "road", label: U.road, n: counts.road }, { id: "fuel", label: U.fuel, n: counts.fuel }, { id: "praise", label: U.praise, n: counts.praise }];
  const trucks = [...new Map(allEv.map((e) => [e.vehicleId, e.plate])).entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  const openF = open.filter(match), doneF = done.filter(match), list = events.filter((e) => e.kind !== "idle" && match(e));
  const recent = list.filter((e) => e.min != null && nowMin - e.min < 60), older = list.filter((e) => !(e.min != null && nowMin - e.min < 60));
  const nothing = !openF.length && !doneF.length && !list.length;
  const reset = () => { setKind("all"); setTruck(""); };
  const card = (e: FeedEvent, extra: Partial<Parameters<typeof Card>[0]> = {}) => <Card key={e.id} e={e} F={F} nowMin={nowMin} clapped={claps.has(e.id)} onClap={clap} fresh={fresh.has(e.id)} U={U} day={day} open={openId === e.id} onToggle={toggle} {...extra} />;
  // „trage pentru actualizare” (touch, doar sus de tot)
  const onTS = (ev: React.TouchEvent) => { y0.current = window.scrollY <= 0 && story == null ? ev.touches[0].clientY : null; };
  const onTM = (ev: React.TouchEvent) => { if (y0.current == null || busy) return; const dy = ev.touches[0].clientY - y0.current; setPull(dy > 0 ? Math.min(110, dy * 0.5) : 0); };
  const onTE = () => {
    if (y0.current == null) return; y0.current = null;
    if (pull > 60) { setBusy(true); setPull(56); setTimeout(() => { const got = release(); if (!got) setToast(F.nothingNew); setBusy(false); setPull(0); }, 900); } else setPull(0);
  };
  return (
    <div className="feed" onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      <div className="fpull" style={{ height: pull, opacity: Math.min(1, pull / 60) }} aria-hidden={!pull}><span className={busy ? "spin" : ""} style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }}>↻</span><small>{busy ? F.refreshing : pull > 60 ? F.release : F.pull}</small></div>
      <div className="fstories" role="list">
        {data.stories.map((s, k) => (
          <button key={s.vehicleId} type="button" role="listitem" className={`fst st-${s.status}`} onClick={() => setStory(k)} aria-label={fill(F.story, { name: s.driver })}>
            <Avatar hue={s.hue} initials={s.initials} size={58} ring={ST_COL[s.status]} />
            <span>{s.driver.split(" ")[0]}</span><small>{s.plate}</small>
          </button>
        ))}
      </div>
      {unseen ? <button type="button" className="fnew" onClick={() => { scrollTo({ top: 0, behavior: "smooth" }); setUnseen(0); }}>↑ {unseen === 1 ? F.new1 : fill(F.newPill, { n: unseen })}</button> : null}
      <LiveNow U={U} stamp={stamp} />
      <FeedChips U={U} kinds={kinds} kind={kind} setKind={setKind} trucks={trucks} truck={truck} setTruck={setTruck} />
      {nothing ? <FeedEmpty U={U} onReset={reset} /> : null}
      {openF.length || doneF.length || (kind === "all" && !truck && attn.length) ? (
        <section className="fpin" aria-live="polite">
          <div className={`fsec${openF.length ? "" : " ok"}`}>{openF.length ? <>{F.attn}<span className="fcnt">{openF.length}</span></> : <>✓ {F.attnNone}</>}</div>
          {openF.map((e) => card(e, { clapped: false, res: null, onRes: demo ? onRes : undefined }))}
          {doneF.length ? <details className="fres"><summary>{F.resolved} · {doneF.length}</summary>{doneF.map((e) => card(e, { clapped: false, res: res[e.id], onRes }))}</details> : null}
        </section>
      ) : null}
      <section className="flist" aria-live="polite">
        {recent.length ? <div className="fday"><span className="flive" />{U.now}</div> : null}
        {recent.map((e) => card(e))}
        {older.length ? <div className="fday">{recent.length ? U.earlier : U.today}</div> : null}
        {older.map((e) => card(e))}
      </section>
      <div className="fend"><span>✓</span><b>{F.upToDate.replace(" ✓", "")}</b><p>{F.upToDateSub}</p></div>
      {toast ? <div className="ftoast" role="status">{toast}</div> : null}
      {story != null ? <StoryView stories={data.stories} start={story} F={F} onClose={() => setStory(null)} /> : null}
    </div>
  );
}
