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

## Runda 16 octombrie — sursa datelor de carburant

| ID | Prioritate | Problemă | Remediere / verificare |
|---|---|---|---|
| QA-25 | P1 | GPS și alimentări prezentate drept consum real/furt confirmat | Texte RO/EN/PL în login, alerte, import, asistent, flux și tur; butonul devine „Marchează verificată”. Alerta nu stabilește vinovăție. |
| QA-26 | P1 | Replay calcula nivel de rezervor pornind arbitrar de la 55%, inclusiv în firme reale | Nivel necunoscut în cont real; procentul rămâne doar în demo, cu ipoteza explicită. Litrii din GPS × rată sunt etichetați estimați. |
| QA-27 | P1 | Sume asociate alertelor intrau în totalul economiilor și puteau fi dublate | Eliminată conversia alertelor în litri pierduți/bani protejați. Afișăm numărul alertelor; scenariile nu intră în total. |
| QA-28 | P2 | Referința istorică omitea alimentările fără kilometraj și putea lega citiri imposibile | Nu se construiește interval peste o citire lipsă, între camioane sau cu viteză imposibilă. Referința rămâne estimativă, fără plin-la-plin verificat. |
| QA-29 | P2 | O poziție GPS la ±30 min era descrisă ca fiind exact la ora plății | Explicația arată ora punctului folosit și fereastra. Lipsa GPS nu este etichetată automat „privat”. |
| QA-30 | P2 | Regula de nivel putea folosi o serie de date fără camion marcat cu sondă | Regula cere explicit sondă; integrarea în conturi reale este marcată planificată. |
| QA-31 | P2 | Economii includea curse anulate/alte luni, iar Acasă folosea luna curentă | Aceeași selecție reportViews, fără anulate; proiecția reală folosește zilele lunii curente, nu vechimea contului. |
| QA-32 | P2 | Litrii manuali/estimați și referințele implicite nu erau identificabile | Proveniență pe cursă și camion; istoric estimat/normă declarată/implicit, plus etichetă pentru datele fictive. |
| QA-33 | P2 | Replay atribuia golurile GPS modului privat fără dovadă | În cont real, golurile sunt „Lipsă date GPS”; cauza nu este dedusă automat. |

Regresii dedicate: `npm run smoke:fuel-evidence` (incluse în `npm run smoke`).
Acoperă lipsa tranzacțiilor, GPS absent/vechi/alt camion, punct apropiat, sursa temporală,
kilometraj lipsă/imposibil, sondă absentă și totaluri fără anomalii/anulări/luni anterioare.

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
| OPEN-10 | P1 | Calitatea reconcilierii carburant | Importul păstrează orele locale fără fus explicit; GPS telefon folosește ora București. Pentru comparații internaționale: fus per sursă, UTC normalizat, precizia punctului, alimentări complete/plin-la-plin, corecții și jurnal. Până atunci, diferențele GPS cer verificarea orelor; nu sunt dovezi de furt. |
| OPEN-11 | P2 | Integrare planificată | CAN/FMS și sonde reale: contract/provider, calibrare, nivel inițial/final, alimentări și consum pe același interval, validare pe vehicule pilot. Demo-ul nu dovedește funcționarea hardware. |

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

## Rezultat runda carburant — 16 octombrie

- 381 verificări PASS în suita completă, reliability PostgreSQL și card-periods,
  inclusiv cele 11 regresii noi de proveniență și calcul. Fără FAIL în runda completă.
- Build de producție și TypeScript trecute; cele trei avertismente img existente rămân.
  i18n, fuel-evidence și demo reluate după ajustările finale de text/proiecție.
- Browser: Alerte, Economii, Import și Replay la 320/390/768/1280 px, RO/EN/PL,
  16 combinații fără controale ieșite lateral. Nu înlocuiește testarea pe telefoane reale.
- Cont fictiv pe PostgreSQL local: cursă cu sursă „estimare”, referință declarată,
  replay cu nivel necunoscut și gol GPS fără cauză presupusă. Nu s-au folosit date de client.
- Demo: „Marchează verificată” → „Anomalie verificată”, atenția scade; fără constatare
  de furt. Proiecția Acasă/Economii este identică, inclusiv rotunjirea (12.359 lei în fixture).
- Captură: `qfleet-fuel-evidence.png`. Loguri temporare: `/tmp/igo-fuel-smoke.log`,
  `/tmp/igo-fuel-build.log`, `/tmp/igo-fuel-demo-final.log`.
- OPEN-10/11 documentează explicit ce mai trebuie pentru reconciliere și integrare hardware.

## Audit sincronizare patron–șofer — 16 octombrie 2026 (deschis)

Scope: audit înaintea implementării, pe commit `cfeb62b`; fără modificări ale aplicației
sau publicare. PostgreSQL local separat și două identități fictive, fără date de client.
Priorități: P1 = afectează încrederea în starea operațională; P2 = consistență/reziliență.

| ID | Prioritate | Problemă și dovadă | Remediere propusă |
| --- | --- | --- | --- |
| SYNC-01 | P1 | `/api/live` folosește `liveFleet` și pentru firme reale. Reprodus HTTP: camion nou, zero poziții, zero ture → `demo:false`, `moving`, 38 km/h, 64 km, coordonate Oradea. Aceeași ieșire după activarea modului privat. Pagina `/live` folosește separat `realLive`; nu am identificat un consumator UI al endpointului defect. Nu este dovadă de divulgare a poziției reale: coordonatele sunt inventate. | Un singur serviciu real pentru pagină și API; fără GPS → locație necunoscută; privat → fără coordonate/traseu. Teste pe conținut, nu doar `demo:false`. |
| SYNC-02 | P1 | Pagina șoferului nu verifică modificările primite de la patron. `DriverOutbox` reîncarcă numai dacă a expediat operațiuni locale. Reprodus în browser: cursă nouă atribuită în DB la 18:21:02 UTC nu apare în pagina deschisă la 18:21:56 UTC (54 s, peste intervalul outbox de 30 s); reîncărcarea manuală o aduce imediat. | Actualizare periodică și la revenirea în aplicație, cu păstrarea formularelor nesalvate; ulterior notificări server dacă volumul justifică. |
| SYNC-03 | P1 | Curse/listă, detaliu cursă, bonuri și Acasă nu au actualizare periodică. Numai harta reală (20 s) și fluxul real (30 s) folosesc `AutoRefresh`. Confirmat în cod; evenimentele reale încărcat/descărcat au răspuns 200 și ambele au fost găsite în PostgreSQL. | Actualizare consecventă a ecranelor operaționale; afișarea ultimei sincronizări și stare de eroare. Test simultan patron/șofer. |
| SYNC-04 | P1 | Demo: descărcarea răspunde 200, dar nu persistă. Reprodus POST `bh21qrt-15` → GET `/driver`: `unloadedAt:null` înainte și după. Butonul revine la „Apasă când e gata”. Uploadul demo răspunde și el 200 fără salvarea fișierului (confirmat în cod). Extinde OPEN-05. | Stare demo izolată și persistentă pe sesiune, comună celor două roluri; evenimente și atașamente cu aceeași semantică de confirmare ca în conturile reale. |
| SYNC-05 | P1 | Demo pe două browsere/dispozitive nu partajează tura/privat/bonurile. Sunt cookie-uri locale. Reprodus: aceeași autentificare demo, cu cookie-ul de pauză → `private`; fără cookie-ul de pauză → `moving`. | Cameră demo partajabilă prin link, expirabilă, cu reset explicit. Fiecare demonstrație izolată de celelalte. |
| SYNC-06 | P2 | Fluxul patronului numără stările GPS diferite de `offline`, nu `onShift`. Reprodus: șoferul pornește tura fără GPS; jurnalul arată „a început tura”, sumarul arată `0/1 în tură`. | Separarea „în tură”, „GPS recent”, „privat” și „oprit”; contor bazat pe tura salvată. |
| SYNC-07 | P1 | `DriverApp` marchează GPS `ok` înainte de filtrarea preciziei și nu verifică răspunsul HTTP la ping. Km cresc local înaintea confirmării serverului. Confirmat în cod; HTTP în privat returnează corect 409. Nu am simulat GPS pe telefon în această rundă. | Indicatori separați pentru semnal și transmitere, ultimul punct acceptat de server, gestionare 401/403/409/5xx și reconcilierea kilometrilor. |
| SYNC-08 | P1 | `DriverApp` inițializează tura/privat/km din props, dar nu le reconciliază ulterior. Watcherul GPS depinde doar de `on,priv`, nu de camion; componenta nu are cheie per camion. La schimbarea alocării prin refresh poate păstra starea/closure-ul camionului vechi. Confirmat în cod, scenariu complet pe telefon netestat. | Reconciliere explicită cu starea serverului, oprire/repornire watcher la schimbarea camionului și curățare la demontare; protejarea operațiunilor offline existente. |
| SYNC-09 | P2 | Salvarea evenimentului cursei și jurnalul patronului sunt separate. `logDriver` ignoră erorile; retrimiterea unui eveniment duplicat nu repară jurnalul. Confirmat în cod, fără injecție de eroare DB în această rundă. | Scriere atomică sau outbox tranzacțional, jurnal recuperabil și monitorizarea eșecurilor. |

### Ordine recomandată pentru implementare

1. SYNC-01/06: adevărul datelor și indicatorilor. Aceeași stare pentru API și pagini.
2. SYNC-02/03/08: primirea actualizărilor și reconcilierea componentelor. Nu ajunge
   doar adăugarea unui timer dacă starea locală rămâne blocată la valorile inițiale.
3. SYNC-07/09: confirmări server, retry și jurnal consistent.
4. SYNC-04/05: demo complet, partajabil între patron și șofer.

### Criterii pentru retestarea severă după remedieri

- Două sesiuni: atribuire, editare, anulare, încărcare, așteptare, descărcare și POD;
  celălalt rol vede starea în intervalul promis, fără reload manual.
- Rețea întreruptă/restabilită, cerere acceptată cu răspuns pierdut, retrimitere:
  zero duplicate, zero confirmări false, stările pending/blocked vizibile.
- Schimbare camion, sesiune expirată, cont dezactivat: watcherul nu continuă să
  trimită pentru camionul vechi; operațiunile locale nu sunt pierdute tacit.
- GPS absent/vechi/imprecis, privat, tură încheiată: indicatori consecvenți și nicio
  coordonată inventată. GPS în fundal se validează separat pe Android/iOS reale.
- Demo pe două browsere: aceleași evenimente/bonuri/atașamente după reload, fără
  amestecarea datelor între demonstrații.

Dovezi locale temporare: `/tmp/igo-sync-results.log`,
`/tmp/igo-sync-demo-before.html`, `/tmp/igo-sync-demo-after.html`.
Scenariile de mai sus nu echivalează cu testarea completă pe dispozitive reale.

## Remedieri sincronizare — etapa conturi reale, 16 octombrie 2026

- SYNC-01: corectat. API-ul folosește `realLive`, ca pagina hărții; răspuns privat,
  fără cache. Fără poziții: `at:null`, viteză/km zero; în privat: fără traseu.
- SYNC-02/03: corectate. Un singur refresh la 15 s pe ecranele operaționale ale
  ambelor roluri, inclusiv pagina șoferului fără camion. Actualizare și la revenirea
  tabului/conexiunii; fără polling în tab ascuns sau offline. Intervalul este un
  obiectiv de actualizare în prim-plan, nu o garanție de timp real în fundal.
- SYNC-06: corectat. Numărul de șoferi în tură folosește `onShift`, independent de GPS.
- SYNC-07/08: remediate în cod. Datele serverului reconciliază tura, pauza și km;
  kilometrul local nu mai crește înaintea salvării pe server. GPS este confirmat
  numai la HTTP 204, cu expirarea indicatorului după 90 s fără confirmare. Eșecurile,
  precizia slabă și cererile blocate nu mai produc indicator verde. Timeout 15 s;
  cleanup la schimbarea camionului/pauză/demontare, callbackuri vechi ignorate.
  Formularul de bon rămâne asociat camionului pe care a fost început; schimbarea
  alocării blochează trimiterea accidentală pe alt camion, păstrând câmpurile.
- SYNC-09: rezolvat pentru evenimentele curselor: stare + eveniment + jurnal scrise
  atomic într-un singur statement PostgreSQL, inclusiv pe driverul Neon HTTP.
  Retrimiterile concurente produc un singur eveniment de jurnal. Turele, schimbările
  de camion și alimentările încă folosesc jurnal best-effort: această parte rămâne
  deschisă și nu este declarată rezolvată de testele pentru curse.
- SYNC-04/05: rămân DESCHISE. Nu s-a introdus încă stocarea demo comună pe server,
  nici persistența evenimentelor/fotografiilor demo. Pollingul singur nu rezolvă
  izolarea cookie-urilor între dispozitive. OPEN-05 rămâne valabil.

Validare: 215 PASS în tenant HTTP/PostgreSQL, reliability memorie/PostgreSQL,
outbox, demo, trip-workflow și i18n, plus regresia PostgreSQL de rollback al
jurnalului. La eroare forțată în `driver_events`, nici starea cursei, nici evenimentul
nu rămân salvate; după eliminarea erorii, aceeași cerere reușește. Build trecut cu
cele trei avertismente img existente; TypeScript și diff-check trecute.

Browser local: alocare nouă observată fără reload în 13 s; formularul deschis cu
123 L păstrat la schimbarea cursei. Pauza privată activată din altă sesiune apare
pe pagina deschisă, cu formularul păstrat. Verificarea pe Android/iOS reale, GPS în
fundal și comportamentul în rețele mobile lente rămân necesare înaintea unei
promisiuni de sincronizare garantată.

Loguri temporare: `/tmp/igo-sync-tests.log`, `/tmp/igo-sync-build.log`,
`/tmp/igo-sync-retest.log`. Acest registru păstrează constatările și limitele;
logurile locale temporare nu sunt necesare aplicației.


## Review sever — 16 octombrie 2026, HEAD de8a51d

Patru defecte confirmate local; toate DESCHISE. Review-ul nu modifică aplicația.
Testele folosesc exclusiv conturi fictive, PostgreSQL local și build-ul de producție
servit local. Deploymentul Vercel este protejat de SSO; rezultatele de mai jos nu
reprezintă validare end-to-end în producție.

### HARSH-01 — P1 — Eroarea citirii turei dezactivează filtrul de confidențialitate

Loc: `src/lib/real-live.ts:12`, `:19–20`.
O eroare `repo.shift()` este convertită în `null`, deci `priv` devine fals.
Cu o tură privată salvată în PostgreSQL, răspunsul normal avea `at:null`;
cu eroare injectată numai la citirea turei, răspunsul avea `status:offline`,
`at:[47,21]` și un punct de traseu. Sunt coordonate istorice, nu poziții colectate
în timpul pauzei private. Statusul offline nu elimină coordonatele din payload.
Defect existent în helper, relevant acum și pentru API-ul live real.
Remediere: starea necunoscută a confidențialității trebuie să ascundă poziția și
traseul sau să producă o eroare explicită. Retest: tură privată + eșec citire tură
nu returnează coordonate în niciuna dintre suprafețele live.

### HARSH-02 — P1 — Retragerea camionului pierde bonul netrimis

Loc: `src/app/driver/page.tsx:33`; câmpurile sunt stare locală în `DriverApp`.
Reprodus în browser: formular Alimentare cu 123 L și stația „Receipt must survive”;
patronul retrage camionul, refresh-ul automat afișează „Camion nealocat”. După
realocare, redeschiderea formularului arată câmpurile goale. Nu s-a apăsat Trimite;
este pierdut un draft, nu un bon deja salvat. Protecția schimbării directe A→B
nu acoperă A→niciun camion: componenta este demontată. Refresh-ul nou face ca
pierderea să apară fără navigare manuală.
Remediere: draft persistent separat pe utilizator și camion, inclusiv fotografia,
sau editor păstrat în afara ramurii de alocare. Retest: A→nimic→A/B, cu draft și
fotografie; fără pierdere și fără trimitere accidentală pe alt camion.
Aceasta restrânge afirmația anterioară SYNC-07/08 despre păstrarea formularului.

### HARSH-03 — P2 — Limita GPS păstrează cele mai vechi 20.000 de puncte

Loc: `src/lib/store/pg.ts:333`; `truckToday` filtrează camionul după citirea firmei.
Reprodus cu 20.001 poziții fictive în aceeași zi: ultima poziție din DB era
[48.85,2.35], dar GET /api/live returna [47,21], poziția de dimineață. Limita este
pe firmă, nu pe camion. Punctele noi sunt salvate, însă sunt excluse din citire;
harta și distanțele pot rămâne în urmă. Defect preexistent.
Remediere: interogare separată pentru ultima poziție a fiecărui camion și
paginare/agregare pentru distanțele zilnice. Inversarea sortării singură ar tăia
începutul zilei și nu rezolvă calculul distanței. Retest: peste limită, mai multe
camioane, puncte recente pentru fiecare și totaluri zilnice complete.

### HARSH-04 — P2 — Cursa livrată dispare înainte de atașarea POD

Loc: `src/app/driver/page.tsx:50`.
Reprodus prin HTTP și PostgreSQL: cursă A azi și B mâine; încărcarea și descărcarea
lui A răspund 200. După descărcare, pagina șoferului selectează B sub „Cursa de azi”,
iar A nu mai apare în pagină. Șoferul nu are aici acces la documentele lui A pentru
a atașa dovada livrării după descărcare. Nu s-a demonstrat blocarea API-ului de
upload; defectul este accesul din interfață. Defect de flux preexistent.
Remediere: acces explicit la curse finalizate/documente de completat și separarea
cursei de azi de cele viitoare. Retest: descărcare A → fotografie POD pentru A,
cu B planificată mâine, inclusiv după refresh/reautentificare.

Dovezi temporare: `/tmp/igo-review-privacy.mjs`, `/tmp/igo-review-gps.mjs`,
`/tmp/igo-review-pod.mjs`; browser local pentru HARSH-02. Suitele trecute anterior
nu acopereau aceste scenarii. SYNC-04/05 și partea restantă SYNC-09 rămân deschise.


## Remedieri HARSH-01–04 — 16 octombrie 2026

- HARSH-01: remediat. Eroarea citirii turei se propagă; nu se construiește un
  payload live cu coordonate pe baza unei stări private necunoscute. Regresie
  automată cu eroare injectată în citirea turei.
- HARSH-02: remediat pentru draft. Câmpurile, fotografia, moneda, data și cheia
  de idempotentă sunt păstrate în IndexedDB separat pe firmă/utilizator, împreună
  cu camionul original. Eroarea stocării este vizibilă, cu fallback în memorie.
  Browser: 123 L și stația păstrate după A→nealocat→A și după reload complet.
  Test automat: fotografia/câmpurile și camionul original supraviețuiesc erorii
  IndexedDB în memorie; un alt utilizator nu primește draftul. Persistența foto
  prin pickerul browserului nu a fost verificată: automatizarea pickerului a
  expirat. Rămâne retestare pe telefon cu cameră, inclusiv quota/storage eviction.
- HARSH-03: remediat. Citire paginată stabil după (at,id), fără trunchiere la
  20.000; filtrare camion și interval în DB pentru ziua curentă/replay. Regresie
  PostgreSQL cu 20.000 de timestampuri identice + puncte recente, alt camion,
  altă zi și altă firmă. Distanța nu pierde începutul intervalului.
- HARSH-04: remediat. Secțiune Curse livrate și pagină de documente accesibilă
  numai șoferului atribuit; disponibilă și fără camion alocat. Curse viitoare
  neîncepute nu mai apar drept cursa de azi. Test HTTP: acces după dezalocare,
  upload POD salvat, podReceived actualizat; altă cursă/ID absent respinse fără
  date (Next poate livra pagina not-found într-un răspuns streamed HTTP 200).
  Browser: pagina livrată afișează atașamentele POD și butoanele de adăugare.

Validare: build producție, TypeScript, smoke auth/outbox/trip-workflow,
reliability memorie + PostgreSQL (inclusiv rollback atomic), smoke-harsh și
smoke-receipt-draft. Cele trei avertismente img preexistente rămân.
Comenzi reproductibile: `TEST_DATABASE_URL=<bază de test> npm run smoke:harsh`
și `npm run smoke:receipt-draft`; nu rula scenariul PostgreSQL pe producție.
SYNC-04/05 (demo comun între dispozitive), restul SYNC-09 și testarea GPS în
fundal pe Android/iOS rămân deschise. Nu declarăm testare end-to-end în producție.
