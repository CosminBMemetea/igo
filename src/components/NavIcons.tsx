"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import { TourNav, startTour } from "./DemoTour";

type It = [IconName, string, boolean];
const ITEMS: It[] = [["feed", "/feed", false], ["home", "/", false], ["live", "/live", false], ["trips", "/trips", false], ["alerts", "/alerts", false], ["crm", "/crm", true], ["docs", "/documents", true], ["receipts", "/receipts", true], ["invoices", "/invoices", true], ["driver", "/driver", true], ["ranking", "/ranking", true], ["features", "/features", false]];
// demo: doar esențialul pentru o firmă de transport
const DEMO: It[] = [["feed", "/feed", false], ["home", "/", false], ["live", "/live", false], ["trips", "/trips", false], ["alerts", "/alerts", false], ["docs", "/documents", true], ["receipts", "/receipts", true], ["upload", "/import", true], ["driver", "/driver", true], ["ranking", "/ranking", true], ["savings", "/savings", false]];
// mobil: 4 principale (în ordinea asta) + „Mai mult”
const OWNER: It[] = [["home", "/", false], ["trips", "/trips", false], ["truck", "/trucks", false], ["people", "/drivers", false], ["live", "/live", true], ["alerts", "/alerts", true], ["feed", "/feed", true], ["docs", "/documents", true], ["receipts", "/receipts", true], ["crm", "/crm", true], ["invoices", "/invoices", true]];
const MAIN: IconName[] = ["feed", "live", "alerts", "trips"];
const lk = (k: IconName) => (k === "upload" ? "import" : k);

function AlertBadge({ n: init }: { n: number }) {
  const [n, setN] = useState(init);
  useEffect(() => setN(init), [init]);
  useEffect(() => { const h = (e: Event) => { const r = (e as CustomEvent<{ r: unknown }>).detail?.r; setN((x) => Math.max(0, x + (r ? -1 : 1))); }; addEventListener("qf-res", h); return () => removeEventListener("qf-res", h); }, []);
  return n ? <b className="nbadge" aria-label={String(n)}>{n > 9 ? "9+" : n}</b> : null;
}

export function NavIcons({ labels, demo, tour, driver, owner, alerts = 0 }: { labels: Record<string, string>; demo?: boolean; tour?: string; driver?: boolean; owner?: boolean; alerts?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [tourFresh, setTourFresh] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); addEventListener("keydown", k); document.documentElement.classList.add("msheet-open"); return () => { removeEventListener("keydown", k); document.documentElement.classList.remove("msheet-open"); }; }, [open]);
  useEffect(() => { if (!tour) return; const u = () => { try { setTourFresh(!JSON.parse(localStorage.getItem("qf-tour2") || "{}").done); } catch { setTourFresh(true); } }; u(); addEventListener("qf-tour-seen", u); addEventListener("storage", u); return () => { removeEventListener("qf-tour-seen", u); removeEventListener("storage", u); }; }, [tour]);
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h) || (h === "/trips" && path.startsWith("/replay") || h === "/trucks" && path.startsWith("/vehicles")) || (h === "/features" && path.startsWith("/plans")));
  const list = owner ? (demo ? [...OWNER, ["upload", "/import", true], ["driver", "/driver", true], ["ranking", "/ranking", true], ["savings", "/savings", true]] as It[] : OWNER) : demo ? DEMO : ITEMS;
  const main = owner ? ["home", "trips", "truck", "people"] : MAIN;
  if (driver) return (
    <nav className="nav">
      {list.map(([k, h, m]) => <Link key={k} href={h} className={`ico${on(h) ? " on" : ""}${m ? " mhide" : ""}`} title={labels[lk(k)]} aria-label={labels[lk(k)]}><Icon name={k} /><small>{labels[lk(k)]}</small></Link>)}
    </nav>
  );
  const more = list.filter(([k]) => !main.includes(k));
  const moreOn = more.some(([, h]) => on(h)) || path.startsWith("/notifications") || path.startsWith("/recomanda") || path.startsWith("/settings");
  return (
    <>
      <nav className={`nav nav5${owner ? " owner-nav" : ""}`}>
        {list.map(([k, h]) => { const mi = main.indexOf(k); return <Fragment key={k}><Link href={h} className={`ico${on(h) ? " on" : ""}${mi < 0 ? " inmore" : ` o${mi + 1}`}`} title={labels[lk(k)]} aria-label={labels[lk(k)]}><span className="nic"><Icon name={k} />{k === "alerts" ? <AlertBadge n={alerts} /> : null}</span><small>{labels[lk(k)]}</small></Link>{tour && k === "alerts" ? <span className="inmore tourwrap"><TourNav label={tour} /></span> : null}</Fragment>; })}
        <button type="button" className={`ico morebtn o5${moreOn || open ? " on" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={labels.more}><span className="nic"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>{tour && tourFresh ? <i className="ndot" /> : null}</span><small>{labels.more}</small></button>
      </nav>
      {open ? (
        <div className="msheet-bg" onClick={() => setOpen(false)}>
          <div className="msheet" role="dialog" aria-modal="true" aria-label={labels.more} onClick={(e) => e.stopPropagation()}>
            <div className="msheet-grab" aria-hidden="true" />
            <div className="msheet-head"><b>{labels.more}</b><button type="button" className="msheet-x" onClick={() => setOpen(false)} aria-label={labels.close}>×</button></div>
            <div className="msheet-grid">
              {more.map(([k, h]) => <Link key={k} href={h} className={`mtile${on(h) ? " on" : ""}`} onClick={() => setOpen(false)}><Icon name={k} /><span>{labels[lk(k)]}</span></Link>)}
              {tour ? <button type="button" className="mtile" onClick={() => { setOpen(false); startTour(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" /></svg><span>{tour}</span>{tourFresh ? <i className="ndot" /> : null}</button> : null}
              <Link href="/notifications" className={`mtile${path.startsWith("/notifications") ? " on" : ""}`} onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" /></svg><span>{labels.notif}</span></Link>
              {!demo ? <Link href="/settings" className={`mtile${path.startsWith("/settings") ? " on" : ""}`} onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg><span>{labels.settings ?? "Setări"}</span></Link> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
