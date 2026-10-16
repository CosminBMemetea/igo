import { t, type Locale } from "@/lib/i18n";

/** One explanation shared by reports, imports and alerts, including empty states. */
export function FuelDataNote({ loc, demo = false }: { loc: Locale; demo?: boolean }) {
  return <details className="fuel-evidence">
    <summary>{t(loc, "fuel.evidenceTitle")}</summary>
    <p>{t(loc, "fuel.evidence")}</p>
    {demo ? <p>{t(loc, "fuel.demo")}</p> : null}
  </details>;
}
