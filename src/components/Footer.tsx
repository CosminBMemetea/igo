import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
/** Subsol cu datele firmei + găzduire UE. Ascuns pe paginile-hartă (ecran complet). */
export function Footer({ loc }: { loc: Locale }) {
  return (
    <footer className="foot">
      <span className="eu" title={t(loc, "ft.euHint")}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>{t(loc, "ft.eu")}</span>
      <span className="co">QUERRA S.R.L. · CUI 53237645 · {t(loc, "ft.addr")}</span>
      <nav><Link href="/privacy">{t(loc, "ft.privacy")}</Link><Link href="/terms">{t(loc, "ft.terms")}</Link><Link href="/support">{t(loc, "ft.contact")}</Link></nav>
    </footer>
  );
}
