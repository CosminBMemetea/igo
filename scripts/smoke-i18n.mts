// smoke:i18n: aceleași chei în ro/en/pl, aceleași {placeholder}-e, niciun text gol; textele „ro|en|pl” din features au 3 părți.
import { CATALOGS, LOCALES, fmtMoney, fmtNum } from "../src/lib/i18n";
import { CATS, FEATURES, PLANS } from "../src/lib/features";
let fail = 0;
const keys = Object.keys(CATALOGS.ro);
const ph = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?::[^}]*)?\}/g)].map((m) => m[1]))].sort().join(","); // {n} și {n:formă/forme} = același placeholder
for (const l of LOCALES) {
  const c = CATALOGS[l] as Record<string, string>;
  const missing = keys.filter((k) => !c[k]?.trim()), extra = Object.keys(c).filter((k) => !keys.includes(k));
  const badPh = keys.filter((k) => c[k] && ph(c[k]) !== ph(CATALOGS.ro[k as keyof typeof CATALOGS.ro]));
  console.log(`${missing.length + extra.length + badPh.length ? "FAIL" : "PASS"} ${l}: ${keys.length} chei${missing.length ? ` lipsă ${missing}` : ""}${extra.length ? ` în plus ${extra}` : ""}${badPh.length ? ` placeholder ${badPh}` : ""}`);
  fail += missing.length + extra.length + badPh.length;
}
const tri = [...FEATURES.flatMap((f) => [f.name, f.desc]), ...Object.values(CATS), ...Object.values(PLANS).flatMap((p) => [p.who, ...p.top])];
const badTri = tri.filter((s) => s.split("|").length !== 3 || s.split("|").some((x) => !x.trim()));
console.log(`${badTri.length ? "FAIL" : "PASS"} features: ${tri.length} texte ro|en|pl${badTri.length ? ` greșite: ${badTri}` : ""}`);
fail += badTri.length;
const fm: [string, string][] = [[fmtNum("ro", 1234567.5, 1), "1.234.567,5"], [fmtNum("en", 1234567.5, 1), "1,234,567.5"], [fmtNum("pl", 1234, 0), "1234"], [fmtNum("pl", 12345, 0), "12\u00a0345"], [fmtMoney("ro", -420), "−420 lei"], [fmtMoney("en", 1670), "RON 1,670"]];
for (const [g, w] of fm) { console.log(`${g === w ? "PASS" : "FAIL"} format ${JSON.stringify(g)}`); if (g !== w) fail++; }
if (fail) { console.error(`smoke:i18n: ${fail} eșec(uri)`); process.exit(1); }
console.log("smoke:i18n OK");
