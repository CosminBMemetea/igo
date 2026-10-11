# iGo — scenariu demo (10 minute) pentru un patron de firmă de transport

Prod: https://igo-kappa.vercel.app · date FICTIVE (firma demo, 8 camioane + 3 utilaje + 1 utilitară, ziua demo 15.10.2026, ora 14:00).
Cifrele de mai jos sunt cele afișate acum; dacă diferă cu puțin, contează ecranul.

Pregătire (înainte de întâlnire): deschide https://igo-kappa.vercel.app/login pe laptop (tema închisă) și pe telefon (pentru pasul 7). Limba din dreapta sus: RO / EN / PL.

| Min | Durerea patronului | Ce arăți (click) | Banii / timpul câștigat |
|---|---|---|---|
| 0:00 | „Nu știu dacă fac bani până la sfârșitul lunii.” | https://igo-kappa.vercel.app/login → **Intră ca demo** → Acasă (`/`) | Sus, mare: **Economie ≈ 11 %** față de consumul de dinainte și **Profit pe cursă ≈ 1.800 lei** (medie pe 68 de curse, total ≈ 123.000 lei în octombrie). „Asta vezi în fiecare dimineață.” |
| 1:00 | „Unde-mi sunt camioanele acum?” | Click pe hartă → `/live` | Camioanele pe drumurile reale; traseul făcut e estompat, cel rămas e albastru. Click pe **BH 21 QRT**: 64 km/h, ETA 18:00, 256 km rămași, profit azi ≈ 2.400 lei. Butonul ▶ = reluarea zilei. Fără telefoane date șoferului. |
| 2:30 | „Cât am câștigat pe cursa asta, de fapt?” | Din panou → **Detaliu cursă** (`/trips/bh21qrt-15`) | Venit 5.360 − motorină 1.380 − taxe 278 − șofer 900 − altele 364 = **profit 2.438 lei (45 % marjă)**; economie 10,9 % (169 lei) la cursa asta. Formula e pe ecran, nu în Excel. |
| 3:30 | „Toate cursele, care merge și care nu.” | `/trips` | Lista cu profit pe fiecare cursă; cele pe pierdere ies în roșu. Întrebare-capcană: „care cursă te-a costat?” |
| 4:30 | „Îmi fură motorina.” | `/alerts` | Alerte cu **„De ce”** în cuvinte: scădere de 79 L în rezervor cu camionul parcat (AR 45 QRT, 02:20–03:00), alimentare peste capacitatea rezervorului (B 120 QRT, 520 L la 400 L), litri prea mulți pe km. „Fiecare alertă = bani pe care îi poți cere înapoi.” |
| 5:30 | „Cardul de motorină e un haos.” | `/import` (cont propriu, nu demo) **sau** spune: „trageți CSV-ul DKV/OMV/MOL/Shell/E100 aici” | Recunoaște formatul singur, leagă cardurile de camioane, nu dublează la reimport, rulează regulile pe ultimele 90 de zile → primele anomalii în prima oră. (Pe firma demo pagina îți spune să oprești „Date demo”.) |
| 6:30 | „Cât mă costă hârtiile și amenzile?” | `/documents` | ITP, RCA, CASCO, rovinietă, tahograf: ce expiră în 30 de zile, cu roșu. O amendă evitată ≈ 3.000 lei + o zi de camion oprit. |
| 7:30 | Șoferul: „nu vreau aplicații complicate” | Pe telefon: `/driver` | Un ecran: pornește tura, checklist în 4 bife, **Alimentare** cu poza bonului (AI citește litrii și suma). Bonul ajunge la patron în `/receipts`, legat de camion și cursă. |
| 8:30 | „Cât mă scoate iGo pe lună?” | `/savings` (sau „Toate economiile →” de pe Acasă) | **≈ 20.300 lei (≈ 3.800 €) în 30 de zile** pentru 12 vehicule: motorină față de bază (măsurat), furt prins (măsurat), plus estimări prudente (amenzi, timp de birou 36 h, încasări). **Proiecție 12 luni ≈ 244.000 lei.** Ipotezele sunt pe ecran (curs BNR 5,3414 din 09.10.2026). |
| 9:15 | „Cât costă / cum încep?” | `/plans` → `/features` | Probă 14 zile, totul deblocat; Start / Pro / Business (prețuri propuse). Pornire: `/signup` → 5 pași ghidați (firmă, camioane, șoferi prin link, documente, CSV card) sau **Asistență Querra** (`/support`) — „o facem împreună în 30 de minute”. |

## Fraze-cheie
- „Nu vă vindem GPS. Vă arătăm profitul pe fiecare cursă și unde se scurg banii.”
- „Fiecare alertă vă spune **de ce**, cu cifrele voastre.”
- „Economia se calculează la prețul de azi al motorinei, ca să nu vă păcălească scumpirile.”

## Dacă ceva nu merge
- Pagina se încarcă greu prima dată (Vercel „rece”): deschideți `/` și `/live` cu 5 minute înainte.
- Harta folosește fundalul Esri fără cheie: OK pentru demo, nu pentru producție.
- Butonul „Intră ca demo” scrie doar în memoria firmei demo, nu în baza de date a clienților.
