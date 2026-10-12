// smoke:rules: fiecare regulă de furt (portată din qerradoc /flota) se declanșează pe datele demo; camioanele curate rămân curate.
import { DemoRepository } from "../src/lib/repo";
import { computeAlerts, whyText, type RuleId } from "../src/lib/fleet/rules";
import { TRUCKS } from "../src/lib/fleet/data";
import { demoRepo as repo } from "../src/lib/repo";
import { alertWhy } from "../src/lib/alert-text";
const r = repo();
const d = await r.fleetData();
const alerts = computeAlerts(d);
const need: [RuleId, string][] = [["km-nepotrivit", "cj08qrt"], ["card-fara-camion", "tm33qrt"], ["scadere-parcat", "ar45qrt"], ["peste-capacitate", "b120qrt"], ["consum-peste-medie", "cj52qrt"], ["consum-peste-normal", "cj08qrt"]];
let fail = 0;
for (const [rule, truck] of need) {
  const hit = alerts.filter((a) => a.rule === rule && a.truckId === truck);
  console.log(`${hit.length ? "PASS" : "FAIL"} ${rule} pe ${truck} (${hit.length})`);
  if (!hit.length) fail++;
  if (hit.some((a) => (["ro", "en", "pl"] as const).some((l) => whyText(l, a).length < 40 || /\{\w+\}/.test(whyText(l, a))))) { console.log(`FAIL ${rule}: explicație lipsă`); fail++; }
}
const clean = TRUCKS.filter((t) => !alerts.some((a) => a.truckId === t.id));
console.log(`${clean.length >= 3 ? "PASS" : "FAIL"} camioane fără alerte: ${clean.map((t) => t.plate).join(", ")}`);
if (clean.length < 3) fail++;
const again = JSON.stringify(computeAlerts(d));
console.log(`${again === JSON.stringify(alerts) ? "PASS" : "FAIL"} determinist`);
if (again !== JSON.stringify(alerts)) fail++;
// alertele de business (pierdere, utilaj peste bază, documente)
// motorul complet (demo-ul afișează doar 3 alerte alese; vezi smoke:demo)
const all = await new DemoRepository(false).alerts();
for (const rule of ["loss", "doc-expiry"] as const) { const n = all.filter((a) => a.rule === rule).length; console.log(`${n ? "PASS" : "FAIL"} ${rule} (${n})`); if (!n) fail++; }
const bad = all.filter((a) => (["ro", "en", "pl"] as const).some((l) => /\{\w+\}|undefined|NaN/.test(alertWhy(l, a))));
console.log(`${bad.length ? "FAIL" : "PASS"} texte alerte complete în ro/en/pl (${all.length})`);
fail += bad.length;
if (fail) { console.error(`smoke:rules: ${fail} eșec(uri)`); process.exit(1); }
console.log("smoke:rules OK");
