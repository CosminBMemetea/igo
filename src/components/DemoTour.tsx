"use client";
// Querra Fleet: tur ghidat pentru demo — spotlight + card, Înainte/Înapoi/Sari peste, puncte de progres. Progresul în localStorage.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TourStep { path: string; sel: string; title: string; body: string }
export interface TourL { next: string; back: string; skip: string; done: string; of: string; trial: string; contact: string; restart: string }
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
  const set = useCallback((s: St) => { setSt(s); save(s); }, []);

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
        if (r.top < 76 || r.bottom > innerHeight - (mobile ? 260 : 40)) { const y = mobile ? r.top + scrollY - 76 : r.top + scrollY - (innerHeight - r.height) / 2; scrollTo({ top: Math.max(0, y), behavior: "smooth" }); }
        setTimeout(() => !dead && setRect(el.getBoundingClientRect()), 380);
        if (step.path.startsWith("/replay")) setTimeout(() => dispatchEvent(new Event("qf-replay-play")), 900);
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

  if (!step) return null;
  const last = st.i === steps.length - 1;
  const pad = 10;
  const hole = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  // cardul: sub element dacă încape, altfel deasupra; pe mobil — foaie jos
  let card: React.CSSProperties = {};
  if (!mobile && hole) {
    const w = 380, below = hole.top + hole.height + 16, fits = below + 260 < innerHeight;
    card = { width: w, left: Math.max(16, Math.min(innerWidth - w - 16, hole.left + hole.width / 2 - w / 2)), ...(fits ? { top: below } : { top: Math.max(16, hole.top - 16 - 250) }) };
    if (hole.height > innerHeight * 0.6) card = { width: w, left: Math.max(16, hole.left + 24), bottom: 32 };
  }
  return (
    <div className={`tour${mobile ? " m" : ""}`} role="dialog" aria-modal="false" aria-label={step.title}>
      <div className={`tour-hole${hole ? "" : " none"}`} style={hole ?? undefined} />
      <div className="tour-card" style={mobile ? (hole && hole.top + hole.height / 2 > innerHeight / 2 ? { top: 76, bottom: "auto" } : undefined) : !hole ? undefined : card} key={st.i}>
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
export function TourButton({ label }: { label: string }) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => { try { setFresh(!localStorage.getItem("qf-tour-seen")); } catch {} }, []);
  return <button type="button" className={`tourbtn${fresh ? " pulse" : ""}`} onClick={() => { try { localStorage.setItem("qf-tour-seen", "1"); } catch {} setFresh(false); closeMenus(); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => dispatchEvent(new Event("qf-tour-start")), 60))); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" /></svg><span>{label}</span></button>;
}
