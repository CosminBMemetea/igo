import { alertTitle, alertWhy } from "@/lib/alert-text";
import { t, type Locale } from "@/lib/i18n";
import type { AppAlert } from "@/lib/repo";
import type { Vehicle } from "@/lib/fleet/seed";
import type { DemoRes } from "@/lib/demo-shift";
import type { FeedText } from "@/lib/feed-i18n";
import { Resolve } from "@/components/Resolve";

export function AlertList({ alerts, vehicles, loc, res, F }: { alerts: AppAlert[]; vehicles: Vehicle[]; loc: Locale; res?: Record<string, DemoRes>; F?: FeedText }) {
  if (!alerts.length) return <p className="sub">{t(loc, "alerts.empty")}</p>;
  return (
    <>
      {alerts.map((a, i) => { const rid = a.theft ? `t-${a.id}` : a.rule === "doc-expiry" ? `c-${a.id}` : null, r = rid && res ? res[rid] : undefined; return (
        <div key={a.id} className={`alert fade d${Math.min(4, i)}${r ? " is-res" : ""}`} id={rid ?? undefined}>
          <span className="dot" style={{ background: a.severity === "high" ? "var(--neg)" : a.severity === "medium" ? "#f5a524" : "var(--acc)" }} />
          <div>
            <div className="t">{alertTitle(loc, a)}{a.vehicleId ? ` · ${vehicles.find((v) => v.id === a.vehicleId)?.name ?? ""}` : ""} {a.theft ? <span className="badge bad" style={{ marginLeft: 6 }}>{t(loc, "alerts.theft")}</span> : null}{a.params?.nogps ? <span className="badge priv" style={{ marginLeft: 6 }} title={t(loc, "priv.nogpsHint")}>{t(loc, "priv.nogps")}</span> : null}</div>
            <p className="sub" style={{ marginTop: 4 }}>{alertWhy(loc, a)}</p>
            {rid && res && F ? <Resolve id={rid} kind={a.theft ? "theft" : "doc"} F={F} init={r ? { a: r.a, ...(r.n ? { n: r.n } : {}) } : null} /> : null}
          </div>
        </div>
      ); })}
    </>
  );
}
