"use client";
// Querra Fleet: tur ghidat pentru demo — spotlight + card, Înainte/Înapoi/Sari peste, puncte de progres. Progresul în localStorage.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** area: (desktop) selectori uniți în zona evidențiată; dock: (desktop) cardul stă în acest element, sub ultimul copil vizibil */
export interface TourStep { path: string; sel: string; title: string; body: string; area?: string[]; dock?: string }
export interface TourL { next: string; back: string; skip: string; done: string; of: string; trial: string; contact: string; restart: string; invT: string; invB: string; invGo: string; invSkip: string }
const KEY = "qf-tour2"; // cheie nouă: ignoră starea veche (auto-pornire)
type St = { i: number; on: boolean; done?: boolean };
const read = (): St | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const save = (s: St) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

/** Închide meniul contului (details.acct) și orice foaie deschisă, ca turul să fie vizibil. */
export function closeMenus() { document.querySelectorAll("details.acct[open]").forEach((d) => d.removeAttribute("open")); (document.activeElement as HTMLElement | null)?.blur?.(); }
export function DemoTour({ steps, L }: { steps: TourStep[]; L: TourL }) {
  const router = useRouter(), path = usePathname();
  const [st, setSt] = useState<St>({ i: 0, on: false });
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mobile, setMobile] = useState(false);
  const target = useRef<Element | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(0);
  useEffect(() => { const c = cardRef.current; if (!c) return; const ro = new ResizeObserver(() => setCardH(c.offsetHeight)); ro.observe(c); return () => ro.disconnect(); });
  const set = useCallback((s: St) => { setSt(s); save(s); }, []);
  // prima vizită demo (patron): invitație la tur — NU pornește singur
  const [invite, setInvite] = useState(false);
  useEffect(() => { let seen = true; try { seen = !!localStorage.getItem("qf-tour-seen") || !!read()?.done; } catch {} if (seen) return; const id = setTimeout(() => setInvite(true), 1400); return () => clearTimeout(id); }, []);
  useEffect(() => { if (st.on) setInvite(false); }, [st.on]);

  // pornire: prima vizită demo → turul pornește singur; altfel reluăm unde a rămas (dacă era activ)
  useEffect(() => {
    const s = read();
    // NU pornește singur: doar din butonul „Tur ghidat”; reluăm doar un tur activ (pornit explicit)
    if (s?.on) setSt(s);
    const start = () => { closeMenus(); set({ i: 0, on: true }); };
    addEventListener("qf-tour-start", start);
    const mq = matchMedia("(max-width:760px)"); setMobile(mq.matches);
    return () => removeEventListener("qf-tour-start", start);
  }, [set]);

  const step = st.on ? steps[st.i] : null;
  useEffect(() => { document.documentElement.style.setProperty("--tour-ch", `${cardH || 190}px`); }, [cardH]);
  useEffect(() => { const on = !!step && step.path.startsWith("/replay"); document.documentElement.classList.toggle("tour-rp", on); if (on) scrollTo(0, 0); return () => document.documentElement.classList.remove("tour-rp"); }, [step, mobile]);
  // navigare la pagina pasului + așteptarea elementului
  useEffect(() => {
    if (!step) { setRect(null); return; }
    closeMenus();
    const [p, q] = step.path.split("?");
    const here = location.pathname === p && (!q || location.search.includes(q));
    if (!here) { setRect(null); router.push(step.path); return; }
    let dead = false, tries = 0;
    const find = () => {
      if (dead) return;
      const el = document.querySelector(step.sel);
      if (el && el.getBoundingClientRect().height > 0) {
        target.current = el;
        const r = el.getBoundingClientRect();
        if (!step.path.startsWith("/replay") && (r.top < 76 || r.bottom > innerHeight - (mobile ? 260 : 40))) { const y = mobile ? r.top + scrollY - 76 : r.top + scrollY - (innerHeight - r.height) / 2; scrollTo({ top: Math.max(0, y), behavior: "smooth" }); }
        setTimeout(() => !dead && setRect(el.getBoundingClientRect()), 380);
        if (step.path.startsWith("/replay")) { setTimeout(() => dispatchEvent(new Event("qf-replay-play")), 900); const bar = document.querySelector<HTMLElement>(".rp-bar"); if (bar) document.documentElement.style.setProperty("--rp-bar-h", `${bar.offsetHeight}px`); }
      } else if (tries++ < 80) setTimeout(find, 100);
      else setRect(null);
    };
    const t0 = setTimeout(find, 150);
    return () => { dead = true; clearTimeout(t0); };
  }, [step, path, router, mobile]);
  useEffect(() => {
    if (!step) return;
    const up = () => { if (target.current) setRect(target.current.getBoundingClientRect()); };
    addEventListener("resize", up); addEventListener("scroll", up, true);
    return () => { removeEventListener("resize", up); removeEventListener("scroll", up, true); };
  }, [step]);
  useEffect(() => {
    if (!step) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") set({ i: st.i, on: false, done: true }); if (e.key === "ArrowRight" && st.i < steps.length - 1) set({ i: st.i + 1, on: true }); if (e.key === "ArrowLeft" && st.i > 0) set({ i: st.i - 1, on: true }); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [step, st.i, steps.length, set]);

  if (!step) return invite ? (
    <div className="tinv" role="dialog" aria-modal="false" aria-labelledby="tinv-t">
      <div className="tinv-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" /></svg></div>
      <div className="tinv-tx"><b id="tinv-t">{L.invT}</b><p>{L.invB}</p></div>
      <div className="tinv-btns">
        <button type="button" className="btn pri" onClick={() => { markSeen(); setInvite(false); closeMenus(); set({ i: 0, on: true }); }}>{L.invGo}</button>
        <button type="button" className="btn sec" onClick={() => { markSeen(); setInvite(false); dispatchEvent(new Event("qf-tour-seen")); }}>{L.invSkip}</button>
      </div>
    </div>
  ) : null;
  const last = st.i === steps.length - 1;
  const pad = 10;
  const soft = step.path.startsWith("/replay");
  let hr: { left: number; top: number; right: number; bottom: number } | null = rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
  if (!mobile && rect && step.area) for (const q of step.area) { const e = document.querySelector(q); if (!e) continue; const r = e.getBoundingClientRect(); if (!r.height) continue; hr = hr ? { left: Math.min(hr.left, r.left), top: Math.min(hr.top, r.top), right: Math.max(hr.right, r.right), bottom: Math.max(hr.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }
  // mobil, pasul reluării: playerul + HUD urcă sus (clasa tour-rp), cardul jos; spotul cuprinde playerul, HUD-ul și harta
  // iOS Safari: bara de sus a browserului poate acoperi partea de sus → playerul + HUD stau jos, deasupra cardului; spotul = harta de deasupra + HUD + player
  if (mobile && soft && rect) { const b = document.querySelector(".rp-bar")?.getBoundingClientRect(), h = document.querySelector(".rp-hud")?.getBoundingClientRect(); const vt = (visualViewport?.offsetTop ?? 0) + 96; if (b) hr = { left: 8, top: Math.max(vt, (h?.top ?? b.top) - 170), right: innerWidth - 8, bottom: b.bottom }; }
  const hole0 = hr ? { left: hr.left, top: hr.top, width: hr.right - hr.left, height: hr.bottom - hr.top } : null;
  const hole = hole0 ? { left: hole0.left - pad, top: hole0.top - pad, width: hole0.width + pad * 2, height: hole0.height + pad * 2 } : null;
  // cardul: sub element dacă încape, altfel deasupra; pe mobil — foaie jos
  // desktop: cardul stă lângă element (dreapta/stânga/dedesubt/deasupra), niciodată peste el; înălțime naturală
  let card: React.CSSProperties = {}, side = "";
  if (!mobile && hole) {
    const w = 360, g = 18, m = 16, top0 = 84, ch = Math.min(cardH || 230, innerHeight - top0 - m);
    const vy = Math.max(top0, Math.min(innerHeight - ch - m, hole.top + Math.min(hole.height, 240) / 2 - ch / 2));
    const hx = Math.max(m, Math.min(innerWidth - w - m, hole.left + hole.width / 2 - w / 2));
    const R = hole.left + hole.width + g, Lx = hole.left - g - w, Bt = hole.top + hole.height + g, At = hole.top - g - ch;
    const opts: [string, boolean, React.CSSProperties][] = [
      ["l", Lx >= m, { left: Lx, top: vy }],
      ["r", R + w <= innerWidth - m, { left: R, top: vy }],
      ["b", Bt + ch <= innerHeight - m, { left: hx, top: Bt }],
      ["t", At >= top0, { left: hx, top: At }],
    ];
    const wide = hole.width > innerWidth * 0.5;
    const order = wide ? [2, 3, 0, 1] : hole.left + hole.width / 2 > innerWidth / 2 ? [0, 1, 2, 3] : [1, 0, 2, 3];
    const pick = order.map((i) => opts[i]).find((o) => o[1]);
    if (pick) { side = pick[0]; card = { width: w, bottom: "auto", ...pick[2] }; const ay = side === "l" || side === "r" ? Math.max(24, Math.min(ch - 24, hole.top + Math.min(hole.height, 240) / 2 - (pick[2].top as number))) : 0; const ax = side === "b" || side === "t" ? Math.max(24, Math.min(w - 24, hole.left + hole.width / 2 - (pick[2].left as number))) : 0; (card as Record<string, unknown>)["--ay"] = `${ay}px`; (card as Record<string, unknown>)["--ax"] = `${ax}px`; }
    else card = { width: w, left: Math.max(m, hole.left + 24), top: "auto", bottom: 28 };
    const dk = step.dock ? document.querySelector(step.dock) : null;
    if (dk) {
      const r = dk.getBoundingClientRect(), kids = [...dk.children].filter((c) => (c as HTMLElement).offsetHeight > 0 && c !== cardRef.current);
      const lastB = kids.length ? Math.max(...kids.map((c) => c.getBoundingClientRect().bottom)) : r.top;
      const ip = 16, top = Math.max(r.top + ip, lastB + 20), ch2 = cardH || 230;
      const maxB = Math.min(innerHeight - 8, r.bottom - ip);
      // încape sub ultimul element → acolo; altfel aliniat jos în coloană
      if (r.width > 260 && r.height > ch2 + ip * 2) { side = "dock"; card = { width: r.width - ip * 2, left: r.left + ip, top: top + ch2 <= maxB ? top : maxB - ch2, bottom: "auto" }; }
    }
  }
  return (
    <div className={`tour${mobile ? " m" : ""}${soft ? " soft" : ""}`} role="dialog" aria-modal="false" aria-label={step.title}>
      <div className={`tour-hole${hole ? "" : " none"}`} style={hole ?? undefined} />
      <div ref={cardRef} data-side={side || undefined} className="tour-card" style={mobile ? (soft ? undefined : hole && hole.top + hole.height / 2 > innerHeight / 2 ? { top: 76, bottom: "auto" } : undefined) : !hole ? undefined : card} key={st.i}>
        <div className="tour-top"><span>{L.of.replace("{i}", String(st.i + 1)).replace("{n}", String(steps.length))}</span><button type="button" onClick={() => set({ i: st.i, on: false, done: true })} aria-label={L.skip}>{L.skip}</button></div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {last ? <div className="tour-cta"><a className="btn pri" href="/signup" onClick={() => set({ i: 0, on: false, done: true })}>{L.trial}</a><a className="btn sec" href="/support" onClick={() => set({ i: 0, on: false, done: true })}>{L.contact}</a></div> : null}
        <div className="tour-foot">
          <div className="tour-dots">{steps.map((_, j) => <button key={j} type="button" className={j === st.i ? "on" : j < st.i ? "past" : ""} onClick={() => set({ i: j, on: true })} aria-label={`${j + 1}`} />)}</div>
          <div className="tour-btns">
            {st.i > 0 ? <button type="button" className="btn sec sm" onClick={() => set({ i: st.i - 1, on: true })}>{L.back}</button> : null}
            <button type="button" className="btn pri sm" onClick={() => (last ? set({ i: 0, on: false, done: true }) : set({ i: st.i + 1, on: true }))}>{last ? L.done : L.next}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
const markSeen = () => { try { localStorage.setItem("qf-tour-seen", "1"); } catch {} };
export const startTour = () => { markSeen(); dispatchEvent(new Event("qf-tour-seen")); closeMenus(); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => dispatchEvent(new Event("qf-tour-start")), 60))); };
/** intrarea „Tur” lângă Alerte (bara de navigare), pulsează până la primul tur */
export function TourNav({ label }: { label: string }) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => { const u = () => { try { setFresh(!read()?.done); } catch {} }; u(); addEventListener("qf-tour-seen", u); addEventListener("storage", u); return () => { removeEventListener("qf-tour-seen", u); removeEventListener("storage", u); }; }, []);
  return <button type="button" className={`ico tourico${fresh ? " pulse" : ""}`} onClick={startTour} title={label} aria-label={label}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" /></svg><small>{label}</small></button>;
}
export function TourButton({ label }: { label: string }) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => { try { setFresh(!localStorage.getItem("qf-tour-seen")); } catch {} }, []);
  return <button type="button" className={`tourbtn${fresh ? " pulse" : ""}`} onClick={() => { try { localStorage.setItem("qf-tour-seen", "1"); } catch {} setFresh(false); closeMenus(); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => dispatchEvent(new Event("qf-tour-start")), 60))); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" /></svg><span>{label}</span></button>;
}
