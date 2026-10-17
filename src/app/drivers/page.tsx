import { SearchField } from "@/components/SearchField";
import { DemoRoster } from "@/components/DemoRoster";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { writableFirm, tenant } from "@/lib/tenant";
import { getPrefs } from "@/lib/prefs";
import { store } from "@/lib/store";
import { t, tri } from "@/lib/i18n";
import { inviteToken, INVITE_TTL_S } from "@/lib/invite";
import { ActionForm } from "@/components/ActionForm";
import { CopyLink } from "@/components/CopyLink";
export const dynamic = "force-dynamic";
export default async function Drivers(props: { searchParams: Promise<{ q?: string; ok?: string }> }) {
  const searchParams = await props.searchParams;
  if ((await tenant()).demo) return <DemoRoster kind="drivers" loc={(await getPrefs()).loc} query={searchParams.q} />;
  const f = await writableFirm();if (!f) redirect("/");
  const { loc } = (await getPrefs()), tr = (s: string) => tri(loc, s);
  const [people, trucks, invitations] = await Promise.all([store().users(f.id), store().trucks(f.id), store().invites(f.id)]);
  const all = people.filter((u) => u.role === "driver");
  const q = (searchParams.q ?? "").trim().toLocaleLowerCase();
  const drivers = all.filter((u) => `${u.name} ${u.phone ?? ""}`.toLocaleLowerCase().includes(q));
  const h = await headers(), origin = process.env.APP_URL || `${h.get("x-forwarded-proto") === "https" ? "https" : "http"}://${h.get("host")}`;
  const links = await Promise.all(invitations.filter((i) => !i.usedAt).map(async (i) => ({ ...i, expired: Date.parse(i.createdAt) + INVITE_TTL_S * 1000 <= Date.now(), url: `${origin}/join?t=${encodeURIComponent(await inviteToken(f.id, i.id, process.env.SESSION_SECRET!, Math.floor(Date.parse(i.createdAt) / 1000)))}` })));
  return <main>
    <div className="eyebrow">{f.name}</div><h1 className="h1">{tr("Șoferi|Drivers|Kierowcy")}</h1>
    <p className="sub">{tr("Adaugă șoferul, asociază camionul și trimite invitația. Poți planifica curse înainte de activarea accesului.|Add a driver, assign a truck and share the invitation. You can plan trips before access is activated.|Dodaj kierowcę, przypisz pojazd i udostępnij zaproszenie. Możesz planować kursy przed aktywacją dostępu.")}</p>
    <div className="invrow" style={{ margin: "20px 0" }}><Link className="btn sec" href="/trucks">{tr("Camioane|Trucks|Pojazdy")}</Link><Link className="btn sec" href="/trips">{t(loc, "nav.trips")}</Link></div>
    {searchParams.ok ? <p className="msg ok" role="status">{t(loc, "stg.saved")}</p> : null}
    <details className="sheet" open={!all.length}><summary className="btn pri">+ {tr("Adaugă șofer|Add driver|Dodaj kierowcę")}</summary>
      <ActionForm action="/api/setup/invite" returnTo="/drivers" loc={loc} reset>
        <label className="lf"><span>{t(loc, "set.drvName")}</span><input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
        <label className="lf"><span>{t(loc, "set.drvPhone")}</span><input name="phone" type="tel" required autoComplete="tel" placeholder="+407…" /></label>
        <label className="lf"><span>{t(loc, "set.drvLang")}</span><select name="locale" defaultValue={loc}><option value="ro">Română</option><option value="en">English</option><option value="pl">Polski</option></select></label>
        <button className="btn pri">{tr("Adaugă șoferul|Add driver|Dodaj kierowcę")}</button>
        <p className="hint">{tr("Invitația nu se trimite automat. După salvare o poți trimite prin WhatsApp sau SMS.|The invitation is not sent automatically. After saving, share it via WhatsApp or SMS.|Zaproszenie nie jest wysyłane automatycznie. Po zapisaniu wyślij je przez WhatsApp lub SMS.")}</p>
      </ActionForm>
    </details>
    <form method="get" className="roster-search"><SearchField id="roster-query" label={tr("Caută nume sau telefon|Search name or phone|Szukaj imienia lub telefonu")} value={searchParams.q} button={tr("Caută|Search|Szukaj")} /></form>
    <div className="list">{drivers.map((u) => <section className="sheet" key={u.id}>
      <div className="head"><h2>{u.name}</h2><span className={`badge ${u.disabledAt ? "bad" : u.passwordHash ? "ok" : "warn"}`}>{u.disabledAt ? t(loc, "drv.offBadge") : u.passwordHash ? tr("Acces activ|Access active|Dostęp aktywny") : tr("Acces neactivat|Access not activated|Dostęp nieaktywny")}</span></div>
      <p className="sub">{u.phone}</p>
      {!u.disabledAt ? <ActionForm action="/api/drivers/assign" returnTo="/drivers" loc={loc}>
        <input type="hidden" name="uid" value={u.id} />
        <label className="lf"><span>{t(loc, "set.truck")}</span><select name="truck" defaultValue={u.truckId ?? ""}><option value="">{tr("Fără camion|No truck|Bez pojazdu")}</option>{trucks.filter((v) => !v.archivedAt).map((v) => <option key={v.id} value={v.id} disabled={all.some((x) => !x.disabledAt && x.id !== u.id && x.truckId === v.id)}>{v.plate}</option>)}</select></label><button className="btn sec">{t(loc, "stg.save")}</button>
      </ActionForm> : null}
      <details><summary className="btn sec sm">{u.disabledAt ? t(loc, "drv.reactivate") : t(loc, "drv.deactivate")}</summary><ActionForm action="/api/setup/driver" returnTo="/drivers" loc={loc}><input type="hidden" name="uid" value={u.id} /><input type="hidden" name="off" value={u.disabledAt ? "0" : "1"} /><p>{u.disabledAt ? t(loc, "drv.reactivate") : t(loc, "drv.deactivateQ", { name: u.name })}</p><button className="btn sec">{u.disabledAt ? t(loc, "drv.reactivate") : t(loc, "drv.deactivateYes")}</button></ActionForm></details>
    </section>)}</div>
    {!drivers.length ? <p className="sub">{tr("Niciun șofer în această listă.|No drivers in this list.|Brak kierowców na liście.")}</p> : null}
    <section className="section"><h2>{tr("Invitații în așteptare|Pending invitations|Oczekujące zaproszenia")}</h2>{links.map((i) => <div className="sheet" key={i.id}>
      <b>{i.name}</b><p>{i.phone} · {i.revokedAt ? t(loc, "inv.revoked") : i.expired ? tr("Expirată|Expired|Wygasłe") : tr("În așteptare · 14 zile de la creare|Pending · 14 days from creation|Oczekuje · 14 dni od utworzenia")}</p>
      {!i.revokedAt && !i.expired ? <><CopyLink url={i.url} copy={t(loc, "set.copy")} copied={t(loc, "set.copied")} wa={`https://wa.me/${i.phone?.replace("+", "") ?? ""}?text=${encodeURIComponent(t(loc, "set.waText", { firm: f.name }) + " " + i.url)}`} waLabel="WhatsApp" sms={`sms:${i.phone ?? ""}?&body=${encodeURIComponent(i.url)}`} smsLabel="SMS" /><ActionForm action="/api/setup/invite/revoke" returnTo="/drivers" loc={loc}><input type="hidden" name="id" value={i.id} /><button className="btn sec sm">{t(loc, "inv.revoke")}</button></ActionForm></> : <ActionForm action="/api/drivers/reinvite" returnTo="/drivers" loc={loc}><input type="hidden" name="id" value={i.id} /><button className="btn sec">{tr("Creează invitație nouă|Create new invitation|Utwórz nowe zaproszenie")}</button></ActionForm>}
    </div>)}</section>
  </main>;
}
