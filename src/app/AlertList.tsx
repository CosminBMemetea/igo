import { alertTitle, alertWhy } from "@/lib/alert-text";
import { t, type Locale } from "@/lib/i18n";
import type { AppAlert } from "@/lib/repo";
import type { Vehicle } from "@/lib/fleet/seed";

export function AlertList({ alerts, vehicles, loc }: { alerts: AppAlert[]; vehicles: Vehicle[]; loc: Locale }) {
  if (!alerts.length) return <p className="sub">{t(loc, "alerts.empty")}</p>;
  return (
    <>
      {alerts.map((a, i) => (
        <div key={a.id} className={`alert fade d${Math.min(4, i)}`}>
          <span className="dot" style={{ background: a.severity === "high" ? "var(--neg)" : a.severity === "medium" ? "#f5a524" : "var(--acc)" }} />
          <div>
            <div className="t">{alertTitle(loc, a)}{a.vehicleId ? ` · ${vehicles.find((v) => v.id === a.vehicleId)?.name ?? ""}` : ""} {a.theft ? <span className="badge bad" style={{ marginLeft: 6 }}>{t(loc, "alerts.theft")}</span> : null}</div>
            <p className="sub" style={{ marginTop: 4 }}>{alertWhy(loc, a)}</p>
          </div>
        </div>
      ))}
    </>
  );
}
