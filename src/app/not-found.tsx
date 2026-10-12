import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { t } from "@/lib/i18n";

/** 404 în limba și tema utilizatorului (în locul paginii albe, în engleză, din Next). */
export default function NotFound() {
  const { loc } = getPrefs();
  return (
    <main className="login" style={{ maxWidth: 520, textAlign: "center" }}>
      <div className="eyebrow fade">404</div>
      <h1 className="h1 fade">{t(loc, "nf.title")}</h1>
      <p className="sub fade d1">{t(loc, "nf.sub")}</p>
      <Link href="/" className="btn pri fade d2" style={{ marginTop: 24, display: "inline-flex" }}>{t(loc, "nf.home")}</Link>
    </main>
  );
}
