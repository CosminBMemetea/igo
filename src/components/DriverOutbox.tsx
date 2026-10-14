"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tri, type Locale } from "@/lib/i18n";
import { flushOutbox, outboxItems, removeOutbox, retryOutbox, type OutboxItem } from "@/lib/outbox";
export function DriverOutbox({ scope, loc }: { scope: string; loc: Locale }) {
  const [items, setItems] = useState<OutboxItem[]>([]), [offline, setOffline] = useState(false), [error, setError] = useState(false), [busy,setBusy] = useState(false);
  const router = useRouter(), tr = (s: string) => tri(loc,s);
  async function sync() {
    if (!navigator.onLine) return;
    setBusy(true);
    try { if (await flushOutbox(scope)) router.refresh(); setError(false); } catch { setError(true); } finally { setBusy(false); }
  }
  async function change(action: () => Promise<void>, retry = false) {
    setBusy(true); setError(false);
    try { await action(); if (retry && navigator.onLine) await flushOutbox(scope); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let alive = true;
    const read = () => { void outboxItems(scope).then((x) => { if (alive) setItems(x); }).catch(() => { if (alive) setError(true); }); };
    const online = () => { setOffline(!navigator.onLine); if (navigator.onLine) void sync(); };
    const synced = () => router.refresh();
    read(); online();
    const interval = setInterval(online, 30000);
    window.addEventListener("igo-outbox-synced", synced); window.addEventListener("igo-outbox", read); window.addEventListener("online", online); window.addEventListener("offline", online);
    return () => { alive = false; clearInterval(interval); window.removeEventListener("igo-outbox-synced", synced); window.removeEventListener("igo-outbox", read); window.removeEventListener("online", online); window.removeEventListener("offline", online); };
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length && !offline && !error) return null;
  return <section className="sheet outbox" aria-live="polite"><h2>{tr("Sincronizare|Sync|Synchronizacja")}</h2>
    <p>{offline ? tr("Fără internet. Operațiunile salvate pe acest telefon vor fi retrimise când revine conexiunea și aplicația este deschisă.|Offline. Saved actions retry when connected and the app is open.|Offline. Zapisane operacje zostaną wysłane po połączeniu, gdy aplikacja jest otwarta.") : `${items.length} ${tr("operațiuni în așteptare|pending actions|operacji oczekujących")}`}</p>
    {error ? <p className="msg err">{tr("Stocarea telefonului nu este disponibilă. Păstrează formularul deschis și încearcă din nou online.|Device storage unavailable. Keep the form open and retry online.|Pamięć niedostępna. Nie zamykaj formularza i spróbuj online.")}</p> : null}
    {items.map((item) => <div key={item.id} className="it"><div><b>{item.label}</b><p className="hint">{item.status === "blocked" ? tr("Necesită verificare: cont, alocare sau stare cursă schimbată. Datele rămân pe telefon.|Needs review: account, assignment or trip status changed. Data stays on this device.|Sprawdź konto, przypisanie lub status kursu. Dane pozostają na urządzeniu.") : tr("Salvat pe telefon · netrimis|Saved on device · not sent|Zapisano na urządzeniu · niewysłane")}</p>
      {item.status === "blocked" ? <button disabled={busy} className="btn sec sm" onClick={() => change(() => retryOutbox(scope,item.id), true)}>{tr("Reîncearcă|Retry|Ponów")}</button> : null}
      <details><summary className="link">{tr("Renunță la această operațiune|Discard this action|Odrzuć operację")}</summary><p>{tr("Șterge doar copia de pe acest telefon. Nu anulează ce a ajuns deja la server.|Deletes this device copy only. Does not undo server changes.|Usuwa tylko kopię na urządzeniu. Nie cofa zmian na serwerze.")}</p><button className="btn sec sm" disabled={busy} onClick={() => change(() => removeOutbox(scope,item.id))}>{tr("Șterge de pe telefon|Delete device copy|Usuń kopię")}</button></details>
    </div></div>)}
    <button className="btn sec" disabled={offline || busy} onClick={sync}>{busy ? tr("Se sincronizează…|Syncing…|Synchronizacja…") : tr("Sincronizează acum|Sync now|Synchronizuj")}</button>
  </section>;
}
