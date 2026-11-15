"use client";

import { useSyncExternalStore } from "react";
import { tri, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const subscribe = () => () => {};
const language = (): Locale => isLocale(document.documentElement.lang) ? document.documentElement.lang : DEFAULT_LOCALE;

/** Recover from a failed page request without exposing server error details. */
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  const loc = useSyncExternalStore(subscribe, language, () => DEFAULT_LOCALE);
  return <main>
    <section className="sheet" role="alert">
      <h1>{tri(loc, "Pagina nu s-a încărcat|Page could not load|Nie udało się załadować strony")}</h1>
      <p className="sub">{tri(loc, "Verifică conexiunea și încearcă din nou. Dacă ai trimis o modificare, verifică lista înainte să o retrimiți.|Check your connection and try again. If you submitted a change, check the list before submitting it again.|Sprawdź połączenie i spróbuj ponownie. Jeśli wysłano zmianę, sprawdź listę przed ponownym wysłaniem.")}</p>
      <div className="invrow">
        <button className="btn pri" onClick={retry}>{tri(loc, "Încearcă din nou|Try again|Spróbuj ponownie")}</button>
        {/* Full document navigation intentionally clears a broken router/error boundary. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn sec" href="/">{tri(loc, "Acasă|Home|Strona główna")}</a>
      </div>
    </section>
  </main>;
}
