// Querra Fleet: matricea de funcții și planuri. O singură sursă, refolosibilă în aplicație.
// Prețurile sunt PROPUNERI (aliniate cu /workspace/fleet-research/competitors-pricing.md), fără TVA.
// Text: "ro|en|pl" (tri() din @/lib/i18n). Portat din fleet-concept/mockups/features.js; ACESTA e acum sursa de adevăr.
export type PlanId = "start" | "pro" | "business";
export type PlanState = PlanId | "trial";
export type FeatureId = "profit" | "savings" | "live" | "fuelAlerts" | "receipts" | "documents" | "driverApp" | "alertsCenter" | "crm" | "invoicing" | "gpsApi" | "cardCsv" | "replay" | "ai" | "maintenance" | "agri" | "reports" | "efactura" | "probe" | "roles";
export interface Plan { name: string; who: string; top: string[]; recommended?: boolean }
export interface Feature { id: FeatureId; rank: number; plan: PlanId; cat: keyof typeof CATS; name: string; desc: string; planned?: boolean }
export const PLAN_ORDER: PlanId[] = ["start", "pro", "business"];
export const TRIAL_DAYS = 30;
export const PLANS: Record<PlanId, Plan> = {
  start: {
    name: "Start", 
    who: "Pentru început, fără aparate în mașini|To get started, no devices in the vehicles|Na start, bez urządzeń w pojazdach",
    top: [
      "Profit pe cursă și economie %|Profit per trip and savings %|Zysk na kurs i oszczędność %",
      "GPS din telefonul șoferului, hartă live|Driver phone GPS, live map|GPS z telefonu kierowcy, mapa na żywo",
      "Bonuri citite de AI și documente cu alerte de expirare|AI-read receipts and documents with expiry alerts|Paragony czytane przez AI i dokumenty z alertami ważności",
    ],
  },
  pro: {
    name: "Pro",  recommended: true,
    who: "Pentru firma care vrea control complet|For firms that want full control|Dla firm, które chcą pełnej kontroli",
    top: [
      "Clienți (CRM), facturi pe cursă, profit pe client|Clients (CRM), invoices per trip, profit per client|Klienci (CRM), faktury za kurs, zysk na klienta",
      "Date din GPS-ul existent și din CSV-ul cardului de carburant|Data from your existing GPS and the fuel-card CSV|Dane z istniejącego GPS i z pliku CSV karty paliwowej",
      "Asistent AI, reluare traseu, zone, ETA, revizii|AI assistant, route replay, geofences, ETA, servicing|Asystent AI, odtwarzanie trasy, strefy, ETA, serwisy",
    ],
  },
  business: {
    name: "Business", 
    who: "Pentru flote cu sondă și echipă de birou|For fleets with fuel probes and an office team|Dla flot z sondami i zespołem biurowym",
    top: [
      "Anti-furt cu sondă în rezervor (prin partener)|Anti-theft with a tank probe (via partner)|Ochrona przed kradzieżą z sondą w zbiorniku (przez partnera)",
      "Export e-Factura, SmartBill, SAGA (planificat)|e-Factura, SmartBill, SAGA export (planned)|Eksport e-Factura, SmartBill, SAGA (planowany)",
      "Utilizatori și roluri, API, suport prioritar|Users and roles, API, priority support|Użytkownicy i role, API, priorytetowe wsparcie",
    ],
  },
};
// rank: 1 = cea mai mare valoare pentru client. plan = planul minim care o include.
export const FEATURES: Feature[] = [
  { id: "profit", rank: 1, plan: "start", cat: "core", name: "Profit pe cursă|Profit per trip|Zysk na kurs", desc: "Venit minus motorină, taxe, șofer, alte costuri|Revenue minus diesel, tolls, driver, other|Przychód minus paliwo, opłaty, kierowca, inne" },
  { id: "savings", rank: 2, plan: "start", cat: "core", name: "Economie % față de bază|Savings % vs baseline|Oszczędność % wobec bazy", desc: "L/100km, L/h, L/ha la prețul de azi|L/100km, L/h, L/ha at today's price|l/100 km, l/h, l/ha w dzisiejszej cenie" },
  { id: "live", rank: 3, plan: "start", cat: "track", name: "Hartă live|Live map|Mapa na żywo", desc: "Stare, viteză, șofer, ultima actualizare|Status, speed, driver, last update|Status, prędkość, kierowca, ostatnia aktualizacja" },
  { id: "fuelAlerts", rank: 4, plan: "start", cat: "core", name: "Alerte combustibil|Fuel alerts|Alerty paliwowe", desc: "Alimentări suspecte, consum peste bază|Suspicious fill-ups, over-baseline use|Podejrzane tankowania, spalanie ponad bazę" },
  { id: "receipts", rank: 5, plan: "start", cat: "money", name: "Bonuri cu AI|AI receipts|Paragony z AI", desc: "Poză → dată, stație, litri, sumă, legat de cursă|Photo → date, station, litres, amount, matched to trip|Zdjęcie → data, stacja, litry, kwota, przypisane do kursu" },
  { id: "documents", rank: 6, plan: "start", cat: "docs", name: "Documente și expirări|Documents and expiry|Dokumenty i terminy", desc: "ITP, RCA, CASCO, rovinietă, tahograf, permise|Inspection, insurance, vignette, tachograph, licences|Przegląd, OC, AC, winieta, tachograf, uprawnienia" },
  { id: "driverApp", rank: 7, plan: "start", cat: "track", name: "Aplicația șoferului + checklist|Driver app + checklist|Aplikacja kierowcy + checklista", desc: "Pornire cursă, alimentare, verificare zilnică|Start trip, fill-up, daily check|Start kursu, tankowanie, kontrola dzienna" },
  { id: "alertsCenter", rank: 8, plan: "start", cat: "core", name: "Centru de alerte|Alerts center|Centrum alertów", desc: "Toate alertele, cu „de ce”|All alerts, with the “why”|Wszystkie alerty, z „dlaczego”" },
  { id: "crm", rank: 9, plan: "pro", cat: "money", name: "Clienți (CRM)|Clients (CRM)|Klienci (CRM)", desc: "Contacte, comenzi, profit pe client, plăți|Contacts, orders, profit per client, payments|Kontakty, zlecenia, zysk na klienta, płatności" },
  { id: "invoicing", rank: 10, plan: "pro", cat: "money", name: "Factură pe cursă|Invoice per trip|Faktura za kurs", desc: "Factura din datele cursei, PDF|Invoice from trip data, PDF|Faktura z danych kursu, PDF" },
  { id: "gpsApi", rank: 11, plan: "pro", cat: "track", name: "GPS existent (API)|Existing GPS (API)|Istniejący GPS (API)", desc: "Wialon, TrackGPS, SafeFleet, Webfleet…|Wialon, TrackGPS, SafeFleet, Webfleet…|Wialon, TrackGPS, SafeFleet, Webfleet…" },
  { id: "cardCsv", rank: 12, plan: "pro", cat: "money", name: "Import card carburant + taxe drum|Fuel-card + toll import|Import karty paliwowej + opłat", desc: "DKV, OMV, MOL, Shell, E100, Eurowag|DKV, OMV, MOL, Shell, E100, Eurowag|DKV, OMV, MOL, Shell, E100, Eurowag" },
  { id: "replay", rank: 13, plan: "pro", cat: "track", name: "Reluare traseu, zone, ETA|Route replay, geofences, ETA|Odtwarzanie, strefy, ETA", desc: "Ziua pe hartă, intrări/ieșiri din zone|The day on the map, zone entries/exits|Dzień na mapie, wjazdy/wyjazdy ze stref" },
  { id: "ai", rank: 14, plan: "pro", cat: "core", name: "Asistent AI|AI assistant|Asystent AI", desc: "Întrebări în ro/en/pl, cifre doar din datele tale|Questions in ro/en/pl, numbers only from your data|Pytania po ro/en/pl, liczby tylko z Twoich danych" },
  { id: "maintenance", rank: 15, plan: "pro", cat: "docs", name: "Planificator revizii|Maintenance planner|Planer serwisów", desc: "La km, ore de motor sau dată|By km, engine hours or date|Wg km, motogodzin lub daty" },
  { id: "agri", rank: 16, plan: "pro", cat: "core", name: "Utilaje agricole și parcele|Farm machines and fields|Maszyny rolnicze i pola", desc: "L/h, L/ha, lucrări pe parcelă, bazin fermă|L/h, L/ha, field jobs, farm tank|l/h, l/ha, prace na polu, zbiornik" },
  { id: "reports", rank: 17, plan: "pro", cat: "money", name: "Rapoarte și export contabil|Reports and accountant export|Raporty i eksport dla księgowej", desc: "Excel/CSV lunar, raport zilnic pe email|Monthly Excel/CSV, daily email report|Miesięczny Excel/CSV, codzienny raport e-mail" },
  { id: "efactura", rank: 18, plan: "business", cat: "money", planned: true, name: "e-Factura, SmartBill, SAGA|e-Factura, SmartBill, SAGA|e-Factura, SmartBill, SAGA", desc: "Integrare planificată|Planned integration|Planowana integracja" },
  { id: "probe", rank: 19, plan: "business", cat: "track", name: "Anti-furt cu sondă|Anti-theft with probe|Ochrona z sondą", desc: "Scădere în rezervor cu vehiculul oprit (hardware partener)|Tank drop while parked (partner hardware)|Spadek w zbiorniku na postoju (sprzęt partnera)" },
  { id: "roles", rank: 20, plan: "business", cat: "core", name: "Utilizatori, roluri, API|Users, roles, API|Użytkownicy, role, API", desc: "Dispecer, contabil, mai multe firme|Dispatcher, accountant, multiple companies|Dyspozytor, księgowa, wiele firm" },
];
export const CATS = { core: "Esențial|Essentials|Podstawy", track: "Urmărire|Tracking|Śledzenie", money: "Bani|Money|Pieniądze", docs: "Documente și service|Documents and service|Dokumenty i serwis" } as const;
export function planIncludes(plan: PlanState, featureId: FeatureId): boolean {
  const f = FEATURES.find((x) => x.id === featureId);
  if (!f) return false;
  if (plan === "trial") return true;
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(f.plan);
}
export const isPlanState = (x: unknown): x is PlanState => x === "trial" || x === "start" || x === "pro" || x === "business";

/** Funcțiile afișate (demo axat pe camioane: fără utilaje agricole). */
export const SHOWN_FEATURES = FEATURES.filter((f) => f.id !== "agri");
