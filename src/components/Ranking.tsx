// Querra Fleet: piese de UI pentru clasament (server components).
import Link from "next/link";
import { fmtNum, t, type Locale, type MsgKey } from "@/lib/i18n";
import type { Comp, DriverRank, TruckCmp } from "@/lib/ranking";

const pct = (loc: Locale, x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${fmtNum(loc, Math.abs(x * 100), 0)}%`;
const tone = (s: number) => (s >= 80 ? "pos" : s >= 60 ? "mid" : "neg");
export function ScoreRing({ s, size = 52 }: { s: number; size?: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <span className={`rk-ring ${tone(s)}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r={r} className="bg" /><circle cx="26" cy="26" r={r} className="fg" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - s / 100) }} /></svg>
      <b>{s}</b>
    </span>
  );
}
function metric(loc: Locale, k: Comp, d: DriverRank): string | null {
  switch (k) {
    case "cons": return d.l100 != null ? `${t(loc, "rk.m.l100", { v: fmtNum(loc, d.l100, 1) })} · ${t(loc, "rk.m.vsBase", { v: pct(loc, d.vsBase ?? 0) })}` : null;
    case "harsh": return d.harsh != null ? t(loc, "rk.m.harsh", { v: fmtNum(loc, d.harsh, 1) }) : null;
    case "speed": return d.speedPer100 != null ? t(loc, "rk.m.speed", { v: fmtNum(loc, d.speedPer100, 1) }) : null;
    case "idle": return d.idle != null ? t(loc, "rk.m.idle", { v: fmtNum(loc, d.idle, 1) }) : null;
    case "ontime": return d.onTime != null ? t(loc, "rk.m.ontime", { v: d.onTime }) : null;
    case "alerts": return t(loc, "rk.m.alerts", { n: d.alerts });
  }
}
export function DriverCard({ d, loc, help, rank }: { d: DriverRank; loc: Locale; help?: boolean; rank?: number }) {
  return (
    <div className={`rk-card${help ? " rk-help" : ""}`}>
      <div className="rk-head">
        <ScoreRing s={d.score} />
        <div style={{ minWidth: 0 }}>
          <div className="t">{rank ? <span className="rk-pos">#{rank}</span> : null}{d.driver}</div>
          <div className="m">{d.plate} · {d.l100 != null ? t(loc, "rk.m.l100", { v: fmtNum(loc, d.l100, 1) }) : "—"}</div>
        </div>
      </div>
      {help && d.worst ? (
        <div className="rk-why">
          <b>{t(loc, `rk.why.${d.worst}` as MsgKey)}</b><span>{metric(loc, d.worst, d)}</span>
          <p>💡 {t(loc, `rk.tip.${d.worst}` as MsgKey)}</p>
        </div>
      ) : d.best ? <div className="rk-best">✓ {t(loc, "rk.best", { c: t(loc, `rk.c.${d.best}` as MsgKey) })} · <span>{metric(loc, d.best, d)}</span></div> : null}
    </div>
  );
}
export function TruckBars({ rows, avg, loc }: { rows: TruckCmp[]; avg: number | null; loc: Locale }) {
  const max = Math.max(...rows.map((r) => r.l100 ?? 0), avg ?? 0) * 1.05, min = Math.min(...rows.map((r) => r.l100 ?? 99)) * 0.85;
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <div className="rk-bars">
      {rows.map((r, i) => (
        <div key={r.id} className="rk-bar">
          <Link href={`/vehicles/${r.id}`} className="n"><b>{r.plate}</b><small>{r.model}</small></Link>
          <div className="v"><b>{fmtNum(loc, r.l100 ?? 0, 1)}</b>
            <small className={r.vsFleet != null && r.vsFleet > 0.03 ? "neg" : r.vsFleet != null && r.vsFleet < -0.03 ? "pos" : ""}>{r.vsFleet != null ? pct(loc, r.vsFleet) : ""}</small>
            {r.trend != null ? <small className={`tr ${r.trend > 0.2 ? "neg" : r.trend < -0.2 ? "pos" : ""}`} title={t(loc, "rk.trend")}>{r.trend > 0.2 ? "↑" : r.trend < -0.2 ? "↓" : "→"} {fmtNum(loc, Math.abs(r.trend), 1)}</small> : null}
          </div>
          <div className="track">
            <i className={i === 0 ? "neg" : i === rows.length - 1 ? "pos" : ""} style={{ width: x(r.l100 ?? min) }} />
            {avg ? <span className="avg" style={{ left: x(avg) }} /> : null}
          </div>
          {i === 0 ? <span className="badge bad rk-tag">{t(loc, "rk.most")}</span> : i === rows.length - 1 ? <span className="badge ok rk-tag">{t(loc, "rk.least")}</span> : null}
        </div>
      ))}
      {avg ? <div className="rk-legend"><span className="avg" /> {t(loc, "rk.fleetAvg", { v: fmtNum(loc, avg, 1) })} · ↑↓ {t(loc, "rk.trend")}</div> : null}
    </div>
  );
}
