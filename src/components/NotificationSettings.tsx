"use client";
import { useCallback, useEffect, useState } from "react";
import { tri, type Locale } from "@/lib/i18n";
import styles from "./NotificationSettings.module.css";
type PushState = { publicKey: string | null; active: boolean; devices: number };
type EmailState = { email: string; enabled: boolean; configured: boolean };
async function request<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const value = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(value.error ?? "network");
  return value;
}
export function NotificationSettings({ loc }: { loc: Locale }) {
  const tr = useCallback((s: string) => tri(loc, s), [loc]);
  const [push, setPush] = useState<PushState | null>(null), [mail, setMail] = useState<EmailState | null>(null);
  const [supported, setSupported] = useState(false), [installed, setInstalled] = useState(true), [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(""), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [email, setEmail] = useState(""), [enabled, setEnabled] = useState(true), [password, setPassword] = useState("");
  const explain = useCallback((e: unknown) => {
    const code = e instanceof Error ? e.message : "network";
    setError(code === "unauthorized" ? tr("Sesiunea a expirat. Autentifică-te din nou.|Session expired. Sign in again.|Sesja wygasła. Zaloguj się ponownie.")
      : code === "push-test-failed" ? tr("Serviciul push a respins testul. Reactivează notificările; dacă persistă, contactează asistența.|The push service rejected the test. Enable notifications again; contact support if it persists.|Usługa push odrzuciła test. Włącz powiadomienia ponownie lub skontaktuj się z pomocą.")
      : code === "password" ? tr("Verifică parola sau PIN-ul curent.|Check your current password or PIN.|Sprawdź aktualne hasło lub PIN.")
      : code === "email-unavailable" ? tr("Această adresă nu poate fi folosită. Alege adresa ta de email.|This address is unavailable. Use your own email address.|Ten adres jest niedostępny. Użyj własnego adresu.")
      : ["rate-limit", "wait-one-minute"].includes(code) ? tr("Prea multe încercări. Reîncearcă mai târziu.|Too many attempts. Try again later.|Zbyt wiele prób. Spróbuj później.")
      : tr("Nu am putut confirma schimbarea. Verifică internetul și permisiunile, apoi reîncearcă.|Could not confirm the change. Check your connection and permissions, then try again.|Nie udało się potwierdzić zmiany. Sprawdź połączenie i uprawnienia.") );
  }, [tr]);
  const load = useCallback(async () => {
    const [p, m] = await Promise.allSettled([request<PushState>("/api/notifications/push"), request<EmailState>("/api/notifications/settings")]);
    if (p.status === "fulfilled") setPush(p.value);
    if (m.status === "fulfilled") { setMail(m.value); setEmail(m.value.email); setEnabled(m.value.enabled); }
    if (p.status === "rejected") throw p.reason;
    if (m.status === "rejected") throw m.reason;
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext);
    setPermission("Notification" in window ? Notification.permission : "default");
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setInstalled(!ios || matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    void load().catch(explain);
    });
    return () => cancelAnimationFrame(frame);
  }, [load, explain]); // explicit opt-in; no permission prompt on page load
  async function run(kind: string, action: () => Promise<void>) {
    setBusy(kind); setNotice(""); setError("");
    try { await action(); } catch (e) { explain(e); } finally { setBusy(""); }
  }
  async function subscribe() {
    // Must run directly from a user gesture for Safari/iOS.
    const granted = await Notification.requestPermission(); setPermission(granted);
    if (granted !== "granted") return;
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("worker-timeout")), 10000))]);
    let sub = await reg.pushManager.getSubscription();
    const key = Uint8Array.from(atob(push!.publicKey!.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    if (sub) { await sub.unsubscribe(); sub = null; } // replace any old account/key binding explicitly
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    try { await request("/api/notifications/push", { action: "on", subscription: sub.toJSON() }); }
    catch (e) { await sub.unsubscribe(); throw e; }
    setPush(p => p && { ...p, active: true, devices: Math.max(1, p.devices) }); setNotice(tr("Notificările sunt activate pe acest dispozitiv.|Notifications enabled on this device.|Powiadomienia włączone na tym urządzeniu."));
  }
  const active = push?.active && permission === "granted";
  return <><div className={styles.grid}>
    <section className={styles.card} aria-labelledby="push-title"><h2 id="push-title">{tr("Pe telefon și Mac|On your phone and Mac|Na telefonie i Macu")}</h2>
      <div className={`${styles.state} ${active ? styles.on : ""}`}><span className={styles.dot} />{!push ? tr("Se verifică…|Checking…|Sprawdzanie…") : active ? tr("Activate pe acest dispozitiv|Enabled on this device|Włączone na tym urządzeniu") : tr("Dezactivate pe acest dispozitiv|Disabled on this device|Wyłączone na tym urządzeniu")}</div>
      <p>{tr("Alerte despre documente și verificări, pentru contul tău. Detaliile flotei apar doar după deschiderea aplicației.|Document and task alerts for your account. Fleet details are shown inside the app.|Alerty o dokumentach i zadaniach. Szczegóły floty są widoczne w aplikacji.")}</p>
      {!installed && <p>{tr("Pe iPhone: Safari → Partajează → Adaugă pe ecranul principal. Deschide aplicația de acolo, apoi activează notificările (iOS 16.4 sau mai nou).|On iPhone: Safari → Share → Add to Home Screen. Open the installed app and enable notifications (iOS 16.4 or later).|Na iPhonie: Safari → Udostępnij → Do ekranu początkowego. Otwórz aplikację i włącz powiadomienia (iOS 16.4 lub nowszy).")}</p>}
      {installed && !supported && <p>{tr("Acest browser nu oferă push. Folosește Safari, Chrome, Edge sau Firefox actualizat.|This browser does not support push. Use an updated Safari, Chrome, Edge or Firefox.|Ta przeglądarka nie obsługuje push. Zaktualizuj Safari, Chrome, Edge lub Firefox.")}</p>}
      {permission === "denied" && <p>{tr("Notificările sunt blocate în setările browserului. Permite-le pentru acest site, apoi reîncarcă pagina.|Notifications are blocked in browser settings. Allow them for this site, then reload.|Powiadomienia są zablokowane. Zezwól na nie w ustawieniach i odśwież stronę.")}</p>}
      {push && !push.publicKey && <p>{tr("Serviciul push așteaptă configurarea de către Querra.|Push service is awaiting setup by Querra.|Usługa push oczekuje na konfigurację Querra.")}</p>}
      <div className={styles.actions}>{active ? <><button className="btn sec" disabled={!!busy} onClick={() => void run("off", async () => { await request("/api/notifications/push", { action: "off" }); setPush(p => p && { ...p, active: false, devices: Math.max(0, p.devices - 1) }); const reg = await navigator.serviceWorker.getRegistration(); await (await reg?.pushManager.getSubscription())?.unsubscribe(); })}>{tr("Oprește aici|Disable here|Wyłącz tutaj")}</button><button className="btn" disabled={!!busy || !push?.publicKey} onClick={() => void run("test", async () => { const r = await request<{ status: string }>("/api/notifications/push", { action: "test" }); if (r.status === "failed") throw new Error("push-test-failed"); setNotice(r.status === "accepted" ? tr("Test acceptat de serviciul push. Verifică notificările dispozitivului.|Test accepted by push service. Check your device notifications.|Test przyjęty przez usługę push. Sprawdź urządzenie.") : tr("Testul nu este încă livrat. Coada va reîncerca erorile temporare.|Test not delivered yet. Temporary failures will be retried.|Test nie został jeszcze dostarczony. Błędy tymczasowe zostaną ponowione.")); })}>{busy === "test" ? "…" : tr("Testează push|Test push|Testuj push")}</button></> : <button className="btn" disabled={!!busy || !push?.publicKey || !supported || !installed || permission === "denied"} onClick={() => void run("on", subscribe)}>{busy === "on" ? "…" : tr("Activează notificările|Enable notifications|Włącz powiadomienia")}</button>}</div>
      {!!push?.devices && <button className="btn sec sm" disabled={!!busy} onClick={() => void run("off-all", async () => { await request("/api/notifications/push", { action: "off-all" }); setPush(p => p && { ...p, active: false, devices: 0 }); setNotice(tr("Push oprit pe toate dispozitivele contului. Emailurile păstrează preferința de mai jos.|Push disabled on all account devices. Email preferences are unchanged.|Push wyłączony na wszystkich urządzeniach konta. Preferencje email pozostają bez zmian.")); })}>{tr("Oprește push pe toate dispozitivele|Disable push on all devices|Wyłącz push na wszystkich urządzeniach")} ({push?.devices})</button>}
    </section>
    <form className={styles.card} onSubmit={e => { e.preventDefault(); void run("mail", async () => { await request("/api/notifications/settings", { email, enabled, password }); setPassword(""); await load(); setNotice(tr("Preferințele de email au fost salvate.|Email preferences saved.|Zapisano preferencje email.")); }); }}>
      <h2>{tr("Prin email|By email|Przez email")}</h2><p>{tr("Patronul primește alertele flotei. Șoferul primește doar alertele personale și ale camionului atribuit.|Owners receive fleet alerts. Drivers receive only their personal and assigned vehicle alerts.|Właściciel otrzymuje alerty floty. Kierowca otrzymuje alerty osobiste i przypisanego pojazdu.")}</p>
      <label className="lf"><span>Email</span><input name="email" type="email" disabled={!mail || !!busy} autoComplete="email" maxLength={200} value={email} required={!!email || enabled} onChange={e => setEmail(e.target.value)} /></label>
      {mail && email !== mail.email && <label className="lf"><span>{tr("Parola sau PIN-ul curent|Current password or PIN|Aktualne hasło lub PIN")}</span><input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <label className={styles.check}><input type="checkbox" disabled={!mail || !!busy} checked={enabled} onChange={e => setEnabled(e.target.checked)} />{tr("Primesc alerte despre documente și verificări|Receive document and task alerts|Otrzymuj alerty o dokumentach i zadaniach")}</label>
      {mail && !mail.configured && <p>{tr("Trimiterea emailurilor așteaptă configurarea furnizorului. Salvarea preferințelor nu confirmă livrarea.|Email delivery is awaiting provider setup. Saving preferences does not confirm delivery.|Wysyłka emaili oczekuje na konfigurację. Zapisanie preferencji nie potwierdza dostarczenia.")}</p>}
      <div className={styles.actions}><button className="btn sec" disabled={!!busy || !mail}>{busy === "mail" ? "…" : tr("Salvează preferințele|Save preferences|Zapisz preferencje")}</button></div>
    </form>
  </div>{error && <p className={`msg err ${styles.feedback}`} role="alert">{error} <button className="btn sec sm" disabled={!!busy} onClick={() => void run("reload", load)}>{tr("Reîncarcă preferințele|Reload preferences|Wczytaj preferencje")}</button></p>}{notice && <p className={`msg ok ${styles.feedback}`} role="status">{notice}</p>}</>;
}
