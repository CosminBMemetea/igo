# Registru QA — 15 octombrie 2026

Acest document este registrul de lucru, nu o declarație că aplicația nu mai are buguri.
La fiecare retestare se actualizează rezultatul și commitul. Testele pe telefoane reale
nu sunt înlocuite de redimensionarea browserului. Nu folosi date sau conturi de producție.

## Probleme remediate în această rundă

| ID | Prioritate | Reproducere / problemă | Remediere și retestare |
|---|---|---|---|
| QA-01 | P1 | Login → demo șofer redirecționa la „cont dezactivat” | Sesiunea sintetică semnată nu mai cere utilizator DB; verificările conturilor reale rămân active. Test HTTP și browser. |
| QA-02 | P1 | „Mai mult” deschidea un strat ascuns pe desktop | Dialog nativ pe toate dimensiunile; Escape, focus limitat la dialog și revenire la buton. |
| QA-03 | P2 | La 768 px, contul ieșea din antet | Antet compact între 761–1050 px, fără eliminarea comenzilor. |
| QA-04 | P2 | Documente: tabul Revizii era tăiat la 320 px | Grupurile de taburi se încadrează și trec pe rândul următor. |
| QA-05 | P2 | Butonul de reluare sărea la hover pe mobil; rândurile își schimbau paddingul | Eliminată translația mobilă și schimbarea geometriei rândurilor. |
| QA-06 | P2 | Comenzile fixe acopereau navigarea XXL | Distanța inferioară urmează înălțimea navigării și safe area. |
| QA-07 | P2 | Radio GPS din „Încearcă” avea zonă invizibilă prea lată | Inputul invizibil este limitat la propriul label; nu acoperă alte controale. |
| QA-08 | P2 | Dictare / Completează și explicația ocupau coloane inegale | Butoane pe același rând, explicație pe lățimea disponibilă; dialogul nu micșorează controalele la scroll. |
| QA-09 | P2 | Confirmarea terminării turei nu limita focusul | Dialog nativ cu Escape și revenire la butonul turei. |
| QA-10 | P2 | Checklist șofer nu răspundea la Space/Enter | Activare prin tastatură, aceeași logică precum click. |
| QA-11 | P2 | Demo: km dispăreau la terminarea turei; cronometrul continua | Km demo rămân vizibili, orele folosesc cronometrul oprit la pauză/stop; textul explică începerea unei ture noi. |
| QA-12 | P2 | Confirmare demo la 00:xx apărea înaintea încărcării 07:00 | Ceas virtual pornit la 14:00 pentru evenimente și așteptare; validare pe API, independentă de ora reală. |
| QA-13 | P2 | Importul demo avea numai 6 camioane și specificații diferite | Importul folosește aceeași flotă de 7 camioane. |
| QA-14 | P2 | API live eticheta și firmele reale drept demo | Folosește tenant.demo; regresie HTTP. |
| QA-15 | P2 | Preferința GPS putea arunca eroare când localStorage era blocat | Citire/scriere protejate; în demo nu se afișează opțiunea de GPS real. |
| QA-16 | P2 | Cardurile erau greu de găsit; identificatorii lungi erau trunchiați | Camioane → Carduri carburant; asociere manuală, listă, ghid; respingere peste 40 caractere, control characters și camioane arhivate/inexistente. |
| QA-19 | P2 | Iconița Alimentare era neagră pe buton în tema închisă | Componenta Icon declară conturul currentColor și fill none; simbolurile moștenesc culoarea textului. |
| QA-18 | P2 | Demo: stop → tură nouă → reload pierdea orele anterioare; pauza era inclusă din nou la reload | Totalul de lucru se păstrează în cookie între ture și exclude pauzele; trei regresii automate și retestare stop → start → reload în browser. |
| QA-17 | P2 | Firma reală era încurajată să importe exemple fictive | Exemplele se execută direct doar în sandbox demo; în contul real rămân descărcabile, cu explicație. |

## Runda 16 octombrie — carduri pe perioade

| ID | Prioritate | Problemă | Remediere / verificare |
|---|---|---|---|
| QA-20 | P1 | Mutarea unui card rescria toate alimentările istorice | Perioade [început, următorul început); păstrate intervalele anterioare și ulterioare. |
| QA-21 | P1 | CSV învăța o asociere globală, inclusiv când un card apărea pe două camioane | Potrivire pe data fiecărui rând; alegerile din preview sunt limitate la fișier, fără schimbarea istoricului cardului. |
| QA-22 | P1 | Schimbare simultană de asociere/import putea salva camionul greșit | Blocare tranzacțională per firmă, verificare la insert, rollback pentru întregul lot (test 401 rânduri). |
| QA-23 | P2 | Formularul păstra cratime/spații, parserul le elimina; ID-uri lungi erau trunchiate | Normalizare comună, zerouri păstrate, identificatori prea lungi respinși în CSV și formular. |
| QA-24 | P1 | CSV și istoric puteau indica vehicule diferite fără avertizare | Conflict explicit în preview; import blocat; schimbarea unei perioade incompatibile cu plăcuțele existente este respinsă. |

Migrațiile 0015/0016 sunt aditive. Asocierile vechi sunt păstrate ca bază; tranzacțiile
existente nu sunt rescrise la migrare. Dacă formate diferite ale aceluiași identificator
vechi indică camioane diferite, baza rămâne neasociată și UI cere verificare. Testul de
migrare verifică inclusiv normalizarea, ambiguitatea și reaplicarea fără efecte.

OPEN-02 este închis pentru mutarea cardului cu dată efectivă. Corectarea/ștergerea unei
limite deja existente rămâne o operațiune de suport (OPEN-09); nu se suprascrie implicit.

## Restanțe și limite explicite

| ID | Prioritate | Stare | Criteriu de închidere |
|---|---|---|---|
| OPEN-01 | P1 | De verificat pe dispozitive | Android Chrome + iPhone Safari: dictare, permisiune refuzată/reacordată, ecran blocat 30 min, GPS în fundal, baterie, cameră și HEIC. Înregistrați modelul/OS și rezultat; fără acestea nu se promite GPS continuu. |
| OPEN-03 | P1 | De verificat operațional | Restaurare backup într-o bază separată, alerte erori/cron, verificarea livrării emailurilor, retenția și accesul la fișiere. Nu există dovadă de restaurare a producției în această rundă. |
| OPEN-04 | P1 | Test manual extins | Pierdere rețea 30 min, tab închis/redeschis, memorie dispozitiv plină, sesiune expirată și schimbare cont cu coadă offline. Evenimentele/bonurile au coadă; turele, GPS și CMR/POD necesită internet. |
| OPEN-05 | P2 | Limitare demo, explicată în UI | Confirmările încărcat/descărcat/așteptare și pozele CMR/POD se resetează la reload; tura, privat și bonurile se păstrează în cookie-ul demo. Pentru demo persistent complet: unificare stare per sesiune și teste între roluri/fără amestecarea vizitatorilor. |
| OPEN-06 | P2 | Limitare demo | Fișierele CSV de exemplu au date fixe, independente de data mutată a hărții. Nu reprezintă alimentări reale de azi. Introduceți exemple generate relativ la azi, păstrând fixture-urile de regresie stabile. |
| OPEN-07 | P2 | Îmbunătățire de produs | Profitul nu este încă un registru contabil: separare clară estimat/confirmat și verificare cu contabilul a costurilor, TVA, valute și încasări. |
| OPEN-08 | P3 | Datorie tehnică | Trei avertismente existente pentru optimizarea imaginilor. CSS are multe straturi istorice; separați pe componente după stabilizarea aspectului, cu aceeași matrice vizuală. |
| OPEN-09 | P2 | Flux de corecție controlată | Editarea/ștergerea unei perioade greșite la aceeași dată necesită suport. Adăugați previzualizarea impactului, confirmare explicită, jurnal cu autor și teste pentru refacerea intervalelor; nu ocoliți conflictul introducând o oră falsă. |

P1 = înainte de lansare comercială largă / promisiunea asociată; P2 = următoarea etapă;
P3 = mentenanță. O limitare nu este marcată ca funcționalitate livrată.

## Sesiune de test severă, repetabilă

1. **Pregătire:** bază PostgreSQL dispensabilă; build nou; browser fără cookie demo vechi;
   două firme fictive și doi șoferi; niciun email/SMS trimis clienților reali.
2. **Matrice vizuală:** 320×740, 390×844, 768×900, 1024×768 și 1280×900;
   RO/EN/PL; deschis/închis; L/XL/XXL. Verificați marginile, scrollul, focusul și stările
   disabled/loading/error/success. Tabelele și caruselele cu scroll intenționat nu sunt buguri.
3. **Patron demo:** login, 7/7, Camioane/Șoferi + căutare fără rezultate, filtre curse,
   detaliu/relua­re, taburile Documente, Mai mult + Escape, import anomalii → raport,
   revenire la aceeași pagină, schimbare rol și reset demo.
4. **Șofer demo:** acces direct; bon 100 L / 730 lei / stație cu diacritice → reload →
   patron vede bonul; privat → patron nu vede poziția → reluare; stop → confirmare/anulare;
   checklist cu tastatura → tură nouă; așteptare → stop → descărcare după încărcare.
   GPS real nu trebuie cerut. Confirmările temporare sunt explicate pe pagină.
5. **Patron real, numai în test:** adăugare camion/șofer, invitație, asignare, valori zero,
   nume lungi, card cu zerouri inițiale, card fără camion, camion al altei firme/arhivat,
   CSV duplicat, rând nevalid, monedă străină fără curs, schimbare card istoric.
6. **Curse:** dublu click + retry după timeout, două taburi simultane, cheie reutilizată
   cu alt payload, editare după încărcare, anulare și impact financiar, livrare/completare.
7. **Acces:** driver fără camion/dezactivat, owner în demo fără drept de scriere real,
   schimbare firmă, sesiune expirată, fișiere de la alt tenant, API falsificat.
8. **Dispozitive/rețea:** executați OPEN-01/04; înregistrați separat „netestat” și „eșuat”.
9. **Raport:** pentru fiecare eșec: ID, commit, URL, rol, viewport/OS, pași, rezultat
   așteptat/obținut, captură, severitate, responsabil și retestare. Nu închideți un ID
   doar fiindcă a fost modificat codul.

## Comenzi de regresie

```sh
npm run build
npm run typecheck
TEST_DATABASE_URL=postgres://.../disposable_test npm run smoke
TEST_DATABASE_URL=postgres://.../disposable_test npm run smoke:reliability:pg
TEST_DATABASE_URL=postgres://.../disposable_test npm run smoke:card-periods
```

**Atenție:** suitele tenant/fuel/docs șterg schemele bazei indicate. Rulați-le secvențial,
niciodată pe producție. UI-ul se testează separat în browser; smoke nu verifică pixelii.

## Rezultatul ultimei runde

Runda locală: 15 octombrie 2026, pe modificările livrate împreună cu acest registru.

- Build de producție și TypeScript: trecute. Rămân cele trei avertismente de imagini din OPEN-08.
- Suita completă: 350 verificări PASS, fără FAIL, inclusiv PostgreSQL dispensabil;
  auth/tenant reluate după cele două regresii suplimentare (7 camioane, card pe camion arhivat).
  Demo reluat după cele trei regresii pentru ore între ture/pauze.
- 40 combinații pagină × viewport: 10 pagini la 320×740 (PL, dark), 390×844 (RO, light),
  768×900 (EN, dark), 1280×900 (RO, dark), cu butoane XXL. Fără controale ieșite lateral
  din container în auditul geometric, exceptând tabele/carusele cu scroll intenționat.
  Aceasta nu reprezintă toate combinațiile matricei recomandate de mai sus.
- Verificare vizuală suplimentară: Documente, dialog Cursă nouă, Mai mult, replay;
  badge-ul DEMO și eticheta Camioane la 320 px corectate; comenzile replay separate de navigare.
- Fluxuri browser: bon demo 100 L / 730 lei, schimbare rol, privat ascuns patronului,
  import anomalii → raport, asociere manuală card fictiv 00001234, stop tură cu păstrarea
  kilometrilor, checklist Space/Enter, tură nouă, așteptare → stop → descărcare la ora demo.
- Testele de dispozitive, rețea prelungită și restaurare producție rămân explicit deschise.

Loguri locale: `/tmp/igo-layout-smoke.log`, `/tmp/igo-layout-targeted-final.log`,
`/tmp/igo-layout-build-final.log`. Acestea sunt temporare; rezultatele rezumate aici
rămân versionate în Git. Statusul publicării se verifică separat în integrarea Vercel a commitului.

## Rezultat runda carduri — 16 octombrie

- Suita de perioade verifică MemStore și PostgreSQL: limite exacte, mutări viitoare/
  retroactive, reimport întârziat, identificatori, conflicte de plăcuțe, izolare firme,
  inserări concurente și rollback după 400 rânduri valide + un rând invalid.
- Migrare de la schema anterioară cu date de test, fără modificarea tranzacțiilor.
- Suita completă și reliability PostgreSQL: trecute; parser/fuel/demo reluate după
  corecția normalizării. Build și TypeScript: trecute, aceleași trei avertismente img.
- Browser: card 000123 mutat BH 01 AAA → BH 02 BBB de la 08:00. CSV cu 07:59/08:00
  a produs 100 L / 700 lei la primul camion și 120 L / 840 lei la al doilea.
  CSV contradictoriu la 08:01 a afișat explicația și a dezactivat importul.
- UI la 320, 390, 768 și 1280 px: fără controale ieșite lateral; fără erori în consola
  browserului de test. Captură salvată: `qfleet-card-periods.png`.
- Retestare HTTP după normalizare: trecută. Deploymentul se verifică separat în Vercel.

Loguri locale: `/tmp/igo-card-build.log`, `/tmp/igo-card-smoke.log`.
