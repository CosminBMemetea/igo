// Generează CSV-urile de exemplu din public/samples (date FICTIVE, deterministe). node scripts/make-samples.mjs
import fs from "node:fs";
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const TRUCKS = [{ plate: "BH 21 QRT", l100: 29.5, odo: 412300 }, { plate: "CJ 08 QRT", l100: 31, odo: 655100 }];
const STATIONS = [["OMV Oradea Calea Aradului", "RO"], ["MOL Cluj Florești", "RO"], ["Petrom Deva A1", "RO"], ["OMV Wien Süd", "AT"], ["MOL Budapest M1", "HU"], ["Lukoil Arad Vest", "RO"]];
const p2 = (n) => String(n).padStart(2, "0");
function base(cardPrefix) {
  const rows = [];
  TRUCKS.forEach((t, ti) => {
    let day = 1 + ti, odo = t.odo;
    const card = `${cardPrefix}${ti + 1}00012345${ti}`;
    while (day <= 50) {
      const d = new Date(Date.UTC(2026, 8, day)); // 1 sept → 20 oct 2026
      if (d.getUTCDay() === 0) { day++; continue; }
      const km = 650 + Math.round(rnd() * 400); odo += km;
      const litres = Math.round(km * t.l100 * (0.96 + rnd() * 0.08)) / 100;
      const [st, cc] = STATIONS[Math.floor(rnd() * STATIONS.length)];
      const hh = 7 + Math.floor(rnd() * 11), mm = Math.floor(rnd() * 60);
      rows.push({ y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), hh, mm, card, plate: t.plate, st, cc, litres, price: cc === "RO" ? 7.29 : 7.6, odo });
      day += 2 + Math.floor(rnd() * 2);
    }
  });
  // un card necunoscut (fără număr de înmatriculare în export)
  rows.push({ y: 2026, mo: 10, d: 14, hh: 10, mm: 12, card: `${cardPrefix}9000999999`, plate: "", st: "OMV Oradea Calea Aradului", cc: "RO", litres: 210.4, price: 7.29, odo: null });
  // o linie AdBlue (se ignoră) și una de taxă de drum
  rows.push({ y: 2026, mo: 10, d: 15, hh: 9, mm: 5, card: rows[0].card, plate: TRUCKS[0].plate, st: "OMV Oradea Calea Aradului", cc: "RO", litres: 40, price: 3.1, odo: null, product: "AdBlue" });
  return rows.sort((a, b) => `${a.y}${p2(a.mo)}${p2(a.d)}${p2(a.hh)}`.localeCompare(`${b.y}${p2(b.mo)}${p2(b.d)}${p2(b.hh)}`));
}
const ro = (n, d = 2) => n.toFixed(d).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pl = (n, d = 2) => n.toFixed(d).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const en = (n, d = 2) => n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const amt = (r) => Math.round(r.litres * r.price * 100) / 100;
const prod = (r) => r.product ?? "Diesel";
const F = {
  dkv: { prefix: "70343", head: "Card number;Licence plate;Date;Time;Country;Service station;Product;Quantity;Unit;Gross amount;Currency;Mileage", row: (r) => [r.card, r.plate, `${p2(r.d)}.${p2(r.mo)}.${r.y}`, `${p2(r.hh)}:${p2(r.mm)}`, r.cc, r.st, prod(r), ro(r.litres), "L", ro(amt(r)), "RON", r.odo ?? ""].join(";") },
  "omv-routex": { prefix: "70044", head: "Transaction Date,Card No,Vehicle Registration,Station Name,Country,Product,Volume (l),Amount Gross,Currency,Odometer", row: (r) => [`${r.y}-${p2(r.mo)}-${p2(r.d)} ${p2(r.hh)}:${p2(r.mm)}:00`, r.card, r.plate, q(r.st), r.cc, prod(r), r.litres.toFixed(2), amt(r).toFixed(2), "RON", r.odo ?? ""].join(",") },
  mol: { prefix: "70081", head: "Data tranzacției;Ora;Nr. card;Nr. înmatriculare;Stație;Țara;Produs;Cantitate (l);Valoare brută;Monedă;Km bord", row: (r) => [`${p2(r.d)}.${p2(r.mo)}.${r.y}`, `${p2(r.hh)}:${p2(r.mm)}`, r.card, r.plate, r.st, r.cc, prod(r) === "Diesel" ? "Motorină" : prod(r), ro(r.litres), ro(amt(r)), "RON", r.odo == null ? "" : ro(r.odo, 0)].join(";") },
  shell: { prefix: "70020", head: "Transaction Date,Card Number,Registration Number,Site Name,Country,Product,Quantity,Gross Amount,Currency,Odometer", row: (r) => [`${p2(r.d)}/${p2(r.mo)}/${r.y} ${p2(r.hh)}:${p2(r.mm)}`, r.card, r.plate, q(r.st), r.cc, prod(r), q(en(r.litres)), q(en(amt(r))), "RON", r.odo == null ? "" : q(en(r.odo, 0))].join(",") },
  e100: { prefix: "78260", head: "Data;Karta;Nr rejestracyjny;Stacja;Kraj;Produkt;Ilość;Kwota brutto;Waluta;Przebieg", row: (r) => [`${p2(r.d)}.${p2(r.mo)}.${r.y} ${p2(r.hh)}:${p2(r.mm)}`, r.card, r.plate, r.st, r.cc, prod(r) === "Diesel" ? "Olej napędowy" : prod(r), pl(r.litres), pl(amt(r)), "RON", r.odo == null ? "" : pl(r.odo, 0)].join(";") },
  generic: { prefix: "12345", head: "date,time,card,plate,station,litres,amount,odometer", row: (r) => [`${r.y}-${p2(r.mo)}-${p2(r.d)}`, `${p2(r.hh)}:${p2(r.mm)}`, r.card, r.plate, q(r.st), r.litres.toFixed(2), amt(r).toFixed(2), r.odo ?? ""].join(",") },
};
for (const [name, f] of Object.entries(F)) {
  seed = 7;
  const rows = base(f.prefix);
  fs.writeFileSync(new URL(`../public/samples/${name}.csv`, import.meta.url), "\uFEFF" + [f.head, ...rows.map(f.row)].join("\r\n") + "\r\n");
  console.log(name, rows.length);
}
