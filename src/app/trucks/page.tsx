import { SearchField } from "@/components/SearchField";
import { DemoRoster } from "@/components/DemoRoster";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { writableFirm, tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { t, tri } from "@/lib/i18n";
import { ActionForm } from "@/components/ActionForm";
export const dynamic = "force-dynamic";
export default async function Trucks(
  props: { searchParams: Promise<{ q?: string; archived?: string; ok?: string }> }
) {
  const searchParams = await props.searchParams;
  if ((await tenant()).demo) return <DemoRoster kind="trucks" loc={(await getPrefs()).loc} query={searchParams.q} />;
  const firm = await writableFirm();if (!firm) redirect("/");
  const { loc } = (await getPrefs()), tr = (s: string) => tri(loc, s);
  const [trucks, users] = await Promise.all([store().trucks(firm.id), store().users(firm.id)]);
  const drivers = users.filter((u) => u.role === "driver" && !u.disabledAt);
  const q = (searchParams.q ?? "").trim().toLocaleLowerCase();
  const list = trucks.filter((v) => (!!v.archivedAt === (searchParams.archived === "1")) && `${v.plate} ${v.model ?? ""}`.toLocaleLowerCase().includes(q));
  return <main>
    <div className="eyebrow">{firm.name}</div>
    <h1 className="h1">{tr("Camioane|Trucks|Pojazdy")}</h1>
    <p className="sub">{tr("Adaugă camionul, apoi asociază un șofer. Detaliile tehnice pot fi completate mai târziu.|Add a truck, then assign a driver. Technical details can be added later.|Dodaj pojazd, a następnie przypisz kierowcę. Szczegóły techniczne możesz uzupełnić później.")}</p>
    <div className="invrow" style={{ margin: "20px 0" }}><Link className="btn sec" href="/drivers">{tr("Șoferi și invitații|Drivers and invitations|Kierowcy i zaproszenia")}</Link><Link className="btn sec" href="/import#cards">{tr("Carduri carburant|Fuel cards|Karty paliwowe")}</Link><Link className="btn sec" href="/trips">{t(loc, "nav.trips")}</Link></div>
    {searchParams.ok ? <p className="msg ok" role="status">{t(loc, "stg.saved")}</p> : null}
    <details className="sheet" open={!trucks.length}><summary className="btn pri">+ {t(loc, "stg.addTruck")}</summary>
      <ActionForm action="/api/setup/truck" returnTo="/trucks" loc={loc} reset>
        <label className="lf"><span>{t(loc, "set.plate")}</span><input name="plate" required maxLength={20} autoCapitalize="characters" placeholder="BH 21 QRT" /></label>
        <label className="lf"><span>{t(loc, "set.model")} · {t(loc, "set.optional")}</span><input name="model" maxLength={60} placeholder="Volvo FH 500" /></label>
        <details><summary>{tr("Detalii suplimentare|Additional details|Dodatkowe informacje")}</summary>
          <label className="lf"><span>VIN</span><input name="vin" maxLength={17} /></label>
          <label className="lf"><span>{t(loc, "set.tank")}</span><input name="tank" inputMode="decimal" /></label>
          <label className="lf"><span>{t(loc, "set.l100")}</span><input name="l100" inputMode="decimal" /></label>
        </details>
        <button className="btn pri" style={{ marginTop: 16 }}>{t(loc, "set.addTruck")}</button>
      </ActionForm>
    </details>
    <form className="truck-search" method="get">
      <SearchField id="truck-query" label={tr("Caută număr sau model|Search plate or model|Szukaj numeru lub modelu")} value={searchParams.q} button={tr("Caută|Search|Szukaj")} />
      <label className="lf"><span>{tr("Stare|Status|Status")}</span><select name="archived" defaultValue={searchParams.archived ?? "0"}><option value="0">{tr("În flotă|Active fleet|We flocie")}</option><option value="1">{tr("Arhivate|Archived|Archiwalne")}</option></select></label>
    </form>
    <div className="list">{list.map((v) => {
      const driver = drivers.find((u) => u.truckId === v.id);
      return <section className="sheet" key={v.id}>
        <div className="head"><h2><Link href={`/vehicles/${v.id}`}>{v.plate}</Link></h2><span className="badge">{v.archivedAt ? tr("Arhivat|Archived|Archiwalny") : driver?.name ?? tr("Fără șofer|Unassigned|Bez kierowcy")}</span></div>
        <p className="sub">{v.model || "—"}</p>
        {!v.archivedAt ? driver ? <ActionForm action="/api/drivers/assign" returnTo="/trucks" loc={loc}><input type="hidden" name="uid" value={driver.id} /><input type="hidden" name="truck" value="" /><p>{driver.name} · {driver.passwordHash ? tr("Acces activ|Access active|Dostęp aktywny") : tr("Invitație în așteptare|Invitation pending|Oczekuje na aktywację")}</p><button className="btn sec sm">{tr("Eliberează camionul|Unassign driver|Odłącz kierowcę")}</button></ActionForm> : <ActionForm action="/api/drivers/assign" returnTo="/trucks" loc={loc}>
          <input type="hidden" name="truck" value={v.id} /><div className="assignment-row"><label className="lf"><span>{tr("Asociază șofer|Assign driver|Przypisz kierowcę")}</span><select name="uid" required defaultValue=""><option value="" disabled>{tr("Alege șoferul|Choose driver|Wybierz kierowcę")}</option>{drivers.filter((u) => !u.truckId).map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label><button className="btn pri" type="submit">{t(loc, "stg.save")}</button></div><Link className="link" href="/drivers"> + {tr("Adaugă șofer|Add driver|Dodaj kierowcę")}</Link>
        </ActionForm> : null}
        <details><summary className="btn sec sm">{tr("Editează detaliile|Edit details|Edytuj dane")}</summary>
          <ActionForm action="/api/settings/truck" returnTo="/trucks" loc={loc}>
            <input type="hidden" name="id" value={v.id} />
            <label className="lf"><span>{t(loc, "set.plate")}</span><input name="plate" required defaultValue={v.plate} maxLength={20} /></label>
            <label className="lf"><span>{t(loc, "set.model")}</span><input name="model" defaultValue={v.model ?? ""} maxLength={60} /></label>
            <label className="lf"><span>VIN</span><input name="vin" defaultValue={v.vin ?? ""} maxLength={17} /></label>
            <label className="lf"><span>{t(loc, "set.tank")}</span><input name="tank" inputMode="decimal" defaultValue={v.tankL ?? ""} /></label>
            <label className="lf"><span>{t(loc, "set.l100")}</span><input name="l100" inputMode="decimal" defaultValue={v.normalL100 ?? ""} /></label>
            <button className="btn pri">{t(loc, "stg.save")}</button>
          </ActionForm>
        </details>
        <div className="truck-card-actions"><Link className="btn pri sm" href={`/vehicles/${v.id}/history`}>{tr("Curse și trasee|Trips and routes|Kursy i trasy")}</Link><Link className="btn sec sm" href={`/vehicles/${v.id}?tab=costs`}>{t(loc, "stg.costsArchive")}</Link><Link className="btn sec sm" href="/documents">{t(loc, "nav.docs")}</Link></div>
      </section>;
    })}</div>
    {!list.length ? <p className="sub">{tr("Niciun camion în această listă.|No trucks in this list.|Brak pojazdów na liście.")}</p> : null}
  </main>;
}
