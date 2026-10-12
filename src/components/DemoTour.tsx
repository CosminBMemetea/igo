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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(0);
  useEffect(() => { const c = cardRef.current; if (!c) return; const ro = new ResizeObserver(() => setCardH(c.offsetHeight)); ro.observe(c); return () => ro.disconnect(); });
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
  const soft = step.path.startsWith("/replay");
  const hole = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
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
  }
  return (
    <div className={`tour${mobile ? " m" : ""}${soft ? " soft" : ""}`} role="dialog" aria-modal="false" aria-label={step.title}>
      <div className={`tour-hole${hole ? "" : " none"}`} style={hole ?? undefined} />
      <div ref={cardRef} data-side={side || undefined} className="tour-card" style={mobile ? (soft ? { top: "calc(62px + env(safe-area-inset-top))", bottom: "auto" } : hole && hole.top + hole.height / 2 > innerHeight / 2 ? { top: 76, bottom: "auto" } : undefined) : !hole ? undefined : card} key={st.i}>
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
