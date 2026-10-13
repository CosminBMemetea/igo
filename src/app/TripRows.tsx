import { HScroll } from "@/components/HScroll";
import Link from "next/link";
import { fmtDate, fmtMoney, fmtNum, fmtPct, t, type Locale } from "@/lib/i18n";
import { EL } from "@/lib/econ-i18n";
import type { TripView } from "@/lib/query";

export function TripRows({ rows, loc }: { rows: TripView[]; loc: Locale }) {
  return (
    <HScroll hint={t(loc, "ui.swipe")} min={600}>
      <div>
      {rows.map((r, i) => (
        <div key={r.id} className={`trow${r.vehicle.kind === "truck" ? " has-rp" : ""}`}>
        <Link className={`row fade d${Math.min(4, i)}`} href={`/trips/${r.id}`}>
          <div>
            <div className="t">{r.vehicle.kind === "agri" ? `${t(loc, `type.${r.type}`)} · ${r.title}` : r.title}</div>
            {r.e ? <div className="ebadges"><span className={`pbadge ${r.p.profit < 0 ? "neg" : "pos"}`}>{r.p.profit < 0 ? "▼" : "▲"} {fmtPct(loc, r.p.margin, 0)}</span>{r.e.tonnes === 0 ? <span className="lbadge empty">↩ {EL[loc].emptyRet}</span> : r.e.loadPct !== null ? <span className={`lbadge${r.e.loadPct < 0.5 ? " low" : ""}`}>{fmtNum(loc, r.e.tonnes ?? 0, 1)} t · {fmtPct(loc, r.e.loadPct, 0)}</span> : null}{r.e.emptyKm > 0 && r.e.tonnes !== 0 ? <span className="lbadge km" title={EL[loc].emptyKm}>↩ {fmtNum(loc, r.e.emptyKm)} km</span> : null}</div> : null}
            <div className="m">{[r.vehicle.name, r.vehicle.driver, fmtDate(loc, r.date)].filter(Boolean).join(" · ")}{r.ha ? ` · ${r.ha} ha` : ""}{r.active ? ` · ${t(loc, "trip.active")}` : ""}</div>
          </div>
          <div className="hide"><div className="v">{fmtMoney(loc, r.revenue)}</div><div className="l">{t(loc, "col.revenue")}</div></div>
          <div className="hide"><div className="v">{fmtMoney(loc, r.p.costs)}</div><div className="l">{t(loc, "col.costs")}</div></div>
          <div><div className={`v ${r.p.profit < 0 ? "neg" : "pos"}`}>{fmtMoney(loc, r.p.profit)}</div><div className="l">{fmtPct(loc, r.p.margin, 0)} {t(loc, "col.margin")}</div></div>
          <span className="hide">›</span>
        </Link>
        {r.vehicle.kind === "truck" ? <Link className="rp-rowbtn" href={`/replay?trip=${r.id}`} aria-label={`${t(loc, "rp.cta")} · ${r.title}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg><span>{t(loc, "rp.cta")}</span></Link> : null}
        </div>
      ))}
      </div>
    </HScroll>
  );
}
