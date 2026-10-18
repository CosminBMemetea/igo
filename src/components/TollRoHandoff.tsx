"use client";
import { useRef, useState } from "react";
import { tri, fmtDate, type Locale } from "@/lib/i18n";
import { Icon } from "./icons";

/** Official-portal handoff only. Opening/copying never asserts payment or starts tracking. */
export function TollRoHandoff({ plate, route, date, loc, demo = false }: { plate: string; route: string; date: string; loc: Locale; demo?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const tr = (s: string) => tri(loc, s);
  const text = `${demo ? "DEMO — " : ""}QFleet\n${tr("Camion|Truck|Pojazd")}: ${plate}\n${tr("Traseu planificat|Planned route|Planowana trasa")}: ${route}\n${tr("Data planificată|Planned date|Planowana data")}: ${date}`;
  async function copy() {
    setCopied(false); setFailed(false);
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setFailed(true); input.current?.focus(); input.current?.select(); }
  }
  return <details className="tollro-card">
    <summary><Icon name="trips" size={20} /><span><b>TollRo</b><small>{tr("Pentru segmentul din România · portal oficial|For the Romanian segment · official portal|Dla odcinka w Rumunii · oficjalny portal")}</small></span></summary>
    <div className="tollro-body">
      <p>{tr("Dacă traseul include drumuri taxabile din România, verifică obligațiile și plata în portalul oficial. Datele de mai jos sunt pentru cursa selectată.|If the route includes tolled roads in Romania, check requirements and payment in the official portal. The details below belong to the selected trip.|Jeśli trasa obejmuje płatne drogi w Rumunii, sprawdź obowiązki i płatność w oficjalnym portalu. Poniższe dane dotyczą wybranego kursu.")}</p>
      <div className="tollro-context"><strong>{plate}</strong><span>{route}</span><span>{fmtDate(loc, date, true)}</span></div>
      <p className="hint">{tr("Pregătește MTMA și norma Euro din talon, punctele exacte ale segmentului din România și ora plecării. Tonajul mărfii nu este MTMA.|Have the registered maximum weight and Euro class, exact Romanian route points and departure time ready. Cargo weight is not the registered maximum weight.|Przygotuj DMC i klasę Euro z dowodu rejestracyjnego, dokładne punkty trasy w Rumunii i godzinę wyjazdu. Masa ładunku nie jest DMC.")}</p>
      <textarea ref={input} readOnly value={text} aria-label={tr("Date de copiat în TollRo|Details to copy for TollRo|Dane do skopiowania do TollRo")} rows={4} />
      <div className="tollro-actions"><button className="btn sec" type="button" onClick={copy}><Icon name="copy" size={18} />{tr("Copiază datele|Copy details|Kopiuj dane")}</button><a className="btn pri" href="https://portal.etoll.ro/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{tr("Deschide TollRo ↗|Open TollRo ↗|Otwórz TollRo ↗")}</a></div>
      <p role="status" className="hint">{copied ? tr("Date copiate.|Details copied.|Dane skopiowane.") : failed ? tr("Copierea automată nu este disponibilă. Copiază textul selectat.|Automatic copying is unavailable. Copy the selected text.|Automatyczne kopiowanie jest niedostępne. Skopiuj zaznaczony tekst.") : ""}</p>
      <p className="hint">{demo ? tr("Date demo: nu le folosi pentru cumpărarea unui tichet. |Demo details: do not use these to purchase a ticket. |Dane demonstracyjne: nie używaj ich do zakupu biletu. ") : ""}{tr("QFleet nu transmite automat aceste date, nu pornește sesiunea TollRo și nu verifică plata. Deschiderea portalului nu înseamnă taxă achitată. GPS-ul QFleet nu înlocuiește aplicația/dispozitivul TollRo.|QFleet does not automatically send these details, start a TollRo session or verify payment. Opening the portal does not mean the toll is paid. QFleet GPS does not replace the TollRo app/device.|QFleet nie wysyła automatycznie tych danych, nie uruchamia sesji TollRo ani nie weryfikuje płatności. Otwarcie portalu nie oznacza opłacenia przejazdu. GPS QFleet nie zastępuje aplikacji/urządzenia TollRo.")}</p>
    </div>
  </details>;
}
