import { t, type Locale } from "@/lib/i18n";
/** „În curând”: ce vine prin parteneri (spus cinstit în demo). */
export function Roadmap({ loc }: { loc: Locale }) {
  return (
    <section className="section roadmap">
      <div className="head"><h2>{t(loc, "rm.title")}</h2></div>
      <div className="tiles">
        {(["tacho", "efact", "gps"] as const).map((k) => (
          <div key={k} className="tile" style={{ cursor: "default" }}>
            <span className="badge">{t(loc, "rm.badge")}</span>
            <div className="t" style={{ marginTop: 22 }}>{t(loc, `rm.${k}.t`)}</div>
            <div className="d">{t(loc, `rm.${k}.d`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
