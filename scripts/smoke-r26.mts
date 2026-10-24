// smoke:r26 — regresii din trecerea Testing pe 96f6b7a: plurale RO/EN/PL, bani cu spațiu, nav-ul mobil (fără backdrop-filter pe .top),
// Privat cu „Anulează” 4 s (fără confirmare blocantă), text onest la setări/feed, /join/ready fără aplicația de test, etichete checklist.
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fill, countTri, t, fmtNum, CATALOGS, LOCALES } from "../src/lib/i18n";
import { checklistLabel } from "../src/lib/shift-checklist";
import { PRIV_UNDO_MS, privUndoText } from "../src/components/DriverShiftBar";
import { feedUI } from "../src/lib/feed-ui-i18n";

// 1. plurale prin Intl.PluralRules
const c = (loc: "ro" | "en" | "pl", n: number) => countTri(loc, n, "cursă/curse/de curse|trip/trips|kurs/kursy/kursów");
assert.deepEqual([1, 2, 19, 20, 101, 120].map(n => c("ro", n)), ["1 cursă", "2 curse", "19 curse", "20 de curse", "101 curse", "120 de curse"]);
assert.deepEqual([1, 2, 5].map(n => c("en", n)), ["1 trip", "2 trips", "5 trips"]);
assert.deepEqual([1, 2, 4, 5, 12, 22, 25].map(n => c("pl", n)), ["1 kurs", "2 kursy", "4 kursy", "5 kursów", "12 kursów", "22 kursy", "25 kursów"]);
assert.equal(fill("ro", "{n:zi/zile/de zile}", { n: 21 }), "21 de zile");
assert.equal(fill("pl", "{n:dzień/dni/dni}", { n: 1 }), "1 dzień");
assert.equal(fill("en", "Hi {name}", { name: "Ana" }), "Hi Ana");
// niciun șablon {x:…} rămas nerezolvat în catalogul compilat
for (const loc of LOCALES) for (const k of Object.keys(CATALOGS[loc]) as (keyof typeof CATALOGS.ro)[]) {
  const s = CATALOGS[loc][k]; if (!/\{\w+:/.test(s)) continue;
  const vars = Object.fromEntries([...s.matchAll(/\{(\w+)/g)].map(m => [m[1], 3]));
  const out = t(loc, k, vars); assert.ok(!/\{\w+(:[^}]*)?\}/.test(out), `${loc}.${String(k)} → ${out}`);
}
// 2. bani: „1.528 lei” (cu spațiu)
assert.equal(fmtNum("ro", 1528), "1.528");
for (const f of ["src/app/page.tsx", "src/app/crm/page.tsx", "src/app/trips/[id]/page.tsx"]) {
  const s = readFileSync(f, "utf8"); assert.ok(!/<small>\{t\(loc, ?"cur"\)/.test(s), `${f}: moneda lipită de sumă`);
}
// 3. nav mobil: .top nu are backdrop-filter/filter/transform (le-ar face „containing block” pentru .nav fixă)
const cssFiles = ["src/app/globals.css", ...(existsSync(".next/static/css") ? readdirSync(".next/static/css").filter(x => x.endsWith(".css")).map(x => join(".next/static/css", x)) : [])];
for (const f of cssFiles) {
  const css = readFileSync(f, "utf8");
  for (const m of css.matchAll(/(^|[},])\s*\.top\s*\{([^}]*)\}/g)) for (const d of m[2].matchAll(/(?:^|;)\s*(-webkit-backdrop-filter|backdrop-filter|filter|transform|will-change|contain)\s*:\s*([^;]*)/g)) assert.ok(/^none\b/.test(d[2].trim()), `${f}: .top{${d[1]}:${d[2]}}`);
}
// 4. Privat: o atingere + „Anulează” ~4 s
assert.equal(PRIV_UNDO_MS, 4000);
assert.ok(privUndoText("ro", true).length > 0 && privUndoText("pl", false).length > 0);
const bar = readFileSync("src/components/DriverShiftBar.tsx", "utf8");
assert.ok(bar.includes("Anulează|Undo|Cofnij"), "buton Anulează");
// 5. texte oneste
const settings = readFileSync("src/app/settings/page.tsx", "utf8");
assert.ok(!settings.includes("primește sunet, vibrație și mesaj"), "setări: promisiune exagerată");
assert.ok(settings.includes("cât timp aplicația e deschisă") && settings.includes("GPS-ul se poate opri"), "setări: text exact");
for (const loc of LOCALES) assert.ok(!/live|acum/i.test(feedUI(loc).liveNow), `feed chip ${loc}: ${feedUI(loc).liveNow}`);
assert.ok(!readFileSync("src/components/RealFeed.tsx", "utf8").includes("actualizat la 15 s"));
assert.ok(!/RZECZYWISTY|Rzeczywisty zysk/.test(readFileSync("src/lib/econ-i18n.ts", "utf8")), "PL: Zysk wyliczony");
assert.ok(CATALOGS.pl["drv.start"].length <= 13, `PL start scurt: ${CATALOGS.pl["drv.start"]}`);
// 6. /join/ready: drumul real = PWA, fără aplicația de test
const ready = readFileSync("src/app/join/ready/page.tsx", "utf8");
assert.ok(!ready.includes("qfleet-driver") && !/de test/.test(ready), "join/ready: fără aplicația de test");
// 7. checklist: „gata ✓” doar la 4/4
assert.equal(checklistLabel("ro", 4), "Verificare gata ✓");
assert.ok(!checklistLabel("ro", 3).includes("✓") && checklistLabel("ro", 3).includes("3/4"));
assert.ok(!checklistLabel("en", 2).includes("✓"));
console.log("PASS smoke:r26 plurale, bani, nav mobil, Privat+Anulează, texte oneste, join/ready PWA, checklist");
