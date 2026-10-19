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

## Audit layout — 16 octombrie 2026

- Confirmat: la 320 px, widgeturile demo afișau trunchiat profitul „47.779 lei”
  (117 px text în 98 px disponibili) și „1.060 km”. Remediat: valori complete,
  wrap în loc de ellipsis, o coloană la <=360 px. Retest la 320/360/390/768/1280:
  zero valori KPI sau butoane cu overflow orizontal în pagina Curse.
- Confirmat: formularul Alimentare avea câmpuri de ~102 px și suma de ~77 px la
  320 px. Remediat sub 480 px: etichetă deasupra, input lat; moneda lângă sumă.
  Retest: litri/km/stație 242 px, suma 152 px; pagina rămâne la 320 px, fără
  butoane tăiate. Draftul existent este păstrat.
- Statisticile șoferului folosesc două coloane stabile și font adaptat pe mobil;
  numele, fișierele de bon și textele outbox lungi pot rupe linia în container.
- Scanate Curse, Camioane, Șoferi, Flux, Clasament la 320/390/768/1280 px.
  Flux și Clasament au conținut derulabil orizontal intenționat; nu extind pagina.
  Dialogul Cursă nouă a fost deschis și verificat la fiecare lățime, cu mărimea
  butoanelor XXL: fără overflow orizontal sau text de buton tăiat.
- Build producție trecut; cele trei avertismente img preexistente rămân.
  Acesta este un audit în browser local, nu certificare pentru orice combinație
  de browser, zoom, limbă, date sau tastatură mobilă.

## Cursă nouă — finisare butoane, 16 octombrie 2026

Feedbackul vizual a arătat că simpla lipsă a overflow-ului nu era suficientă.
Butoanele datei au acum trei coloane egale, selecțiile șoferilor au grilă și
aceleași colțuri/înălțimi; starea selectată are contur clar. Dictează și Completează
folosesc iconuri vectoriale și dimensiuni egale (stivuite sub 360 px).
Formularul se derulează în interior; Anulează/Creează cursa rămân într-o bară
separată, vizibilă la bază. Mesajele de validare sunt în afara zonei derulabile.
Verificare vizuală și măsurare: 320×740, 390×500, 768×800, 1280×800; ambele
acțiuni finale în viewport, fără text de buton tăiat. Creare efectivă a unei curse
fictive Viena–München cu șofer/camion autoasociat: confirmare de salvare.

## Driver trip management — 2026-10-17

- Fixed: multiple assigned trips on the same day and overdue trips were hidden behind a single automatically selected trip. Real drivers now have a complete grouped board before the shift form.
- Fixed: future trips were static rows. Every assigned trip now opens its own activity/document page.
- Fixed: trips on a different assigned truck were easy to miss. The board retains them and explains the assignment mismatch; existing server authorization remains unchanged.
- Fixed: drivers without a truck can still see their assigned trips and delivered-trip documents. Cancelled trips remain visible in collapsed history and are read-only.
- Added: delivered trips missing POD remain in a dedicated action group; completed and cancelled history is collapsed.
- Verified: grouping regression covers concurrent same-day trips, overdue/future, loaded future-dated trips, cancelled loaded trips, POD missing/received, historical records, no omissions/duplicates.
- Verified locally with PostgreSQL and a synthetic driver: open assigned trip, load, unload, return to board and see missing POD; another driver's trip returns not-found content. Mobile 320 px and desktop 1100 px have no horizontal page overflow.
- Scope limitation: demo keeps its existing simulated trip actions; its cookie-based state is still not shared between owner and driver. Real-device offline handover, camera uploads and push notifications remain separate QA work. Direct protected production UI was not tested.
- Active trips on the assigned truck open through `/driver?trip=…#trip-paperwork`, retaining the mounted shift/GPS component. Verified both same-day cards and a future card are present; selecting a card opens its own action panel at 390 px. GPS background reliability itself still requires real-device testing.

## Harsh testing — 17 octombrie 2026, HEAD 4f1ed00

**Constatări inițiale, păstrate ca dovadă. Status actualizat în secțiunea „Remedieri GPS și integritate” de mai jos.**
Testare exclusiv locală: build-ul de producție existent, PostgreSQL de unică folosință,
conturi fictive patron/șofer, HTTP și browser. Nicio scriere în datele producției.

### ROUND17-01 — P1 — Arhivarea camionului blochează cursa și ascunde tura activă

Loc: `src/app/api/vehicles/econ/route.ts:35`, `src/app/driver/page.tsx:35`,
`src/components/DriverTrips.tsx:18`.
Reprodus: camion cu șofer alocat, tură deschisă și cursă încărcată. Patronul trimite
`action=archive`: răspuns 303, camion arhivat. Șoferul vede „Camion nealocat”, iar
linkul cursei îl întoarce la `/driver?trip=…` fără butoanele cursei. Tura rămâne
activă în DB. Remediere: blocarea arhivării cât timp există tură/cursă activă sau
un flux explicit și atomic de închidere/transfer; linkurile istorice trebuie să
rămână consultabile. Retest: arhivare concurentă cu încărcarea/pornirea turei.

### ROUND17-02 — P1 — Navigarea la documente oprește colectorul GPS al turei

Loc: `src/components/DriverTrips.tsx:18`,
`src/components/DriverApp.tsx:100–133`, `src/app/driver/trips/[id]/page.tsx:28`.
Reprodus în browser: în tură, deschide istoricul unei curse livrate. Se navighează
pe pagina separată, fără DriverApp, fără Termină tura și fără Privat. Efectul GPS
este deținut de DriverApp, iar cleanup-ul apelează clearWatch și anulează cererea
în curs. Tura din DB rămâne deschisă. Aceeași limită există la alte pagini care
părăsesc ecranul principal. Remediere: un singur gestionar persistent al turei și
GPS în layout-ul șoferului, cu controale de confidențialitate accesibile.
**Nivel de dovadă:** navigare verificată în browser + ciclul de viață confirmat
în cod; browserul de test nu avea GPS disponibil. Nu este un test de coordonate
reale sau de funcționare în fundal pe Android/iOS.

### ROUND17-03 — P1 — Salvarea fotografiei și marcarea POD nu sunt atomice

Loc: `src/app/api/files/route.ts:21–22`.
Reprodus prin eroare injectată local la actualizarea pod_received: uploadul întoarce
404, dar există deja un fișier salvat, în timp ce podReceived rămâne false.
Reîncercarea după înlăturarea erorii răspunde 200 și lasă **două fișiere** pentru
aceeași încărcare. Remediere: operațiune atomică pentru metadate/starea POD,
compensare pentru Blob și cheie de idempotentă pentru reîncercări. Retest:
întrerupere după salvarea fișierului și răspuns pierdut după commit.

### ROUND17-04 — P2 — Conținut invalid acceptat drept POD

Loc: `src/lib/files.ts:8–16`, `src/app/api/files/route.ts:21–22`.
Reprodus: 12 octeți cu textul „not an image”, declarați image/png, primesc 200.
podReceived devine true; cursa intră la Finalizate, dar imaginea apare stricată
în browser (naturalWidth=0). Validarea verifică doar MIME declarat și mărime.
Remediere: verificare a formatului/conținutului real și respingere înainte de
salvare; un fișier tehnic valid nu trebuie confundat cu validarea comercială a
conținutului documentului. Retest: text mascat, fișier trunchiat, PNG/JPEG/PDF valide.

### ROUND17-05 — P2 — Cursa anulată încă acceptă documente prin API

Loc: `src/app/api/files/route.ts:19`, `src/lib/driver-access.ts:16–19`.
Reprodus cu același șofer: evenimentul loaded pe cursa anulată este respins cu 409,
dar upload POD răspunde 200. UI este read-only, însă API verifică doar atribuirea
și firma. Remediere: regulă explicită și comună pentru documentele unei curse
anulate (blocare sau excepție autorizată și jurnalizată). Retest inclusiv un upload
început înainte de anulare și finalizat după aceasta.

### ROUND17-06 — P2 — Erorile interne SQL sunt returnate ca 404 cu detalii

Loc: `src/app/api/files/route.ts:24–26`.
Eroarea injectată la ROUND17-03 a returnat către șofer textul interogării UPDATE,
numele coloanelor și parametrii cu ID-uri. O indisponibilitate internă este etichetată
„not found”, ceea ce împiedică tratarea corectă a reîncercărilor. Remediere: mesaj
public stabil, cod 5xx pentru eroare internă și detalii numai în loguri cu ID de
corelare. Nu s-au observat parole sau tokenuri în răspunsul testat.

### ROUND17-07 — P2 — Checklistul obligatoriu există numai în interfață

Loc: `src/components/DriverApp.tsx:82`, `src/app/api/driver/shift/route.ts:23–24`.
UI cere cel puțin trei verificări. Reprodus: POST start cu checklist=[] primește
200 și creează tură activă, cu checklist gol. Serverul acceptă și șiruri arbitrare,
fără validarea opțiunilor cunoscute. Remediere: validarea aceleiași reguli pe server,
cu valori distincte din lista permisă; păstrarea idempotentei pentru o tură deja
pornită. Retest: gol, duplicate, valori necunoscute, checklist valid.

### Ce a trecut și limitele rundei

- Suitele fără infrastructură au trecut. Smoke tenant a fost inițial sărit fără
  TEST_DATABASE_URL; apoi a fost rulat efectiv: **116 verificări PASS** HTTP/PostgreSQL.
- Smoke card-periods a cerut inițial configurația bazei; rerularea cu PostgreSQL a
  trecut, inclusiv migrare repetabilă și concurență. Nu este defect al aplicației.
- Reliability memorie/PostgreSQL, outbox, draft bon, auth, calcule, i18n, reguli,
  fuel evidence, demo și driver-trips au trecut. Smoke harsh a trecut inclusiv
  peste 20.000 poziții GPS și eșecul citirii confidențialității. Aceste suite nu
  acopereau cele șapte cazuri noi; rezultatele verzi nu le invalidează.
- Browser: încărcarea apare în lista șoferului și în fluxul patronului; documentul
  invalid este într-adevăr ilizibil. Ecranele verificate nu au overflow orizontal:
  documente șofer/flux/curse la 320 px, șoferi/camioane la 390 px. Cursă nouă:
  Anulează/Creează cursa sunt în viewport la 320×740 și 390×500.
- Dovezi temporare: `/tmp/igo-round-backend.mjs`, `/tmp/igo-round-backend.log`,
  `/tmp/igo-round-archive.mjs`, `/tmp/igo-round-tests.log`, `/tmp/igo-round-tenant.log`,
  `/tmp/igo-round-cards.log`, `/tmp/igo-harsh-pod-invalid.png`. Triggerul de eroare a
  fost eliminat în finally; camionul de test a fost restaurat după verificare.
- Suitele tenant/card-periods reconstruiesc schema bazei de test. Nu se rulează
  pe producție sau pe o bază cu date de păstrat.
- Restantele OPEN-01/03/04/10 și SYNC-04/05 rămân: dispozitive reale, offline
  extins, restaurarea backupului, fusuri orare pentru carburant și demo comun.
  Nu s-a făcut certificare end-to-end în producția protejată de SSO.

Feedback: lista de curse este mai clară, dar robustețea fluxurilor de excepție
rămâne în urma interfeței. Prioritate: continuitatea turei, blocarea arhivării
incompatibile și salvarea sigură a documentelor; apoi stări consecvente între
roluri și feedback explicit „pe telefon / confirmat de server”. Funcții noi după
închiderea P1 și probe pe două telefoane reale, cu rețea întreruptă.

## Clarificarea ecranului șoferului — 17 octombrie 2026

- Cursa încărcată este afișată explicit într-un card „Cursa în desfășurare”,
  cu ruta, camionul, data și acces la acțiuni. O cursă doar planificată nu este
  prezentată drept cursă începută. Dacă există mai multe încărcate, apare avertizare.
- Trei liste distincte cu număr: Acum, Urmează, Livrate. Fiecare rând are stare
  explicită; livrările fără POD apar primele și au memento separat. Anulate are
  propriul istoric pliabil. Cursa deschisă și cursa în desfășurare sunt distincte.
- Selectarea automată preferă cursa încărcată, apoi una de încărcat azi/restantă,
  pe camionul curent; nu selectează automat o cursă viitoare ca activitate curentă.
- Aceeași organizare în demo, cu două curse viitoare per camion. Planurile nu au
  încărcări/CMR/POD fictiv finalizate și nu intră în profitul curselor încheiate.
- ROUND17-02: remediat pentru navigarea din noua listă când există camion activ:
  inclusiv documentele livrărilor se deschid în `/driver?trip=…`, păstrând DriverApp.
  Rămâne DESCHIS pentru accesul direct pe ruta separată și navigarea la alte
  pagini; gestionarul GPS global nu a fost extras în această rundă.
- Celelalte șase constatări ROUND17 rămân DESCHISE. Demo-ul păstrează limita deja
  explicată în interfață: confirmările/fotografiile temporare nu sunt stare
  persistentă comună între roluri/dispozitive.
- Verificat în browser cu cont real de test: cursa curentă rămâne aceeași când
  deschizi o cursă viitoare; Livrate diferențiază POD lipsă/trimis; documentele
  păstrează Termină tura/Privat. Demo: Acum 1, Urmează 2, Livrate 7; cursa viitoare
  deschisă nu are evenimente de încărcare/livrare. Layout fără overflow la 320/390 px.
- Regresii: driver-trips (priorități, izolare camion, excluziune câmpuri financiare
  din payloadul client), demo (flotă/hartă/istoric/planuri/economie), build și TypeScript.


## Remedieri GPS și integritate — 17 octombrie 2026

- **ROUND17-01 rezolvat:** baza de date refuză arhivarea unui camion cu tură deschisă sau cursă planificată nelivrată/neanulată. Trigger-ele serializează arhivarea cu pornirea turei și alocarea cursei. Patronul primește mesaj explicit, nu confirmare falsă. Testate ambele ordini archive/start sub blocare reală de rând.
- **ROUND17-02 rezolvat pentru navigarea web:** un colector în layout persistă între pagini; stare autoritativă de la `/api/driver/tracking`, oprire la privat/încheiere, invalidarea răspunsurilor vechi, reluare după revenirea în pagină. Bara de pe celelalte pagini duce la comenzile turei. GPS web în fundal NU este promis și nu este implementare nativă.
- **ROUND17-03 rezolvat pentru metadate/POD:** fișierul și flag-ul POD se salvează atomic în aceeași tranzacție SQL. ID din hash firmă/cursă/tip/conținut; cinci încărcări simultane și reîncercarea întorc un singur fișier. Eroare injectată la POD: rollback complet. Obiectul Blob duplicat este eliminat; la confirmare DB pierdută se verifică dacă obiectul a fost salvat înainte de ștergere. Dacă verificarea DB e imposibilă, obiectul este păstrat și incidentul logat pentru reconciliere. Vercel Blob real nu a fost testat în această rundă.
- **ROUND17-04 rezolvat:** semnătură, MIME și decodare efectivă pentru JPEG/PNG/WebP; limită 25 MP. PDF necesită antet, final și structură parsabilă cu pagină. Fișierele corupte/mascate sunt refuzate înainte de scriere. Nu reprezintă verificare comercială a unui POD, antivirus sau verificare a semnăturii documentului.
- **ROUND17-05 rezolvat:** blocare SQL a uploadului pe cursă anulată, inclusiv după așteptarea lock-ului de anulare. Istoricul existent rămâne consultabil.
- **ROUND17-06 rezolvat pentru upload:** erori cunoscute 4xx; erorile interne sunt 503 cu referință. Clientul nu mai primește SQL sau parametrii interogării. Test HTTP cu eroare injectată confirmă acest lucru.
- **ROUND17-07 rezolvat:** începutul turei necesită cel puțin trei opțiuni cunoscute și distincte, validate pe server. Reîncercarea unei ture deja începute rămâne idempotentă.
- **ROUND17-08 nou, rezolvat:** verificarea turei/private și salvarea poziției telefonului erau separate. Acum `qf_driver_position` blochează rândul turei și verifică alocarea. Poziția care așteaptă după activarea Privat este refuzată; fără tură/în privat/de la alt șofer nu se scrie.
- **ROUND17-09 nou, rezolvat:** cu loadedAt/deliveredAt salvate, dar jurnal de evenimente incomplet, panoul documentelor putea oferi „Am încărcat” din nou. Panoul folosește și starea persistentă a cursei; test de regresie pentru istoric fără evenimente.
- **ROUND17-10 nou, rezolvat:** ajutorul pentru GPS indica doar Safari și pe alte platforme. Instrucțiunile se referă acum la permisiunea site-ului și localizarea dispozitivului, în toate cele trei limbi.

### Verificări reproductibile

Build de producție și typecheck reușite. Runda extinsă: 393 linii PASS, fără FAIL/SKIP,
cu PostgreSQL de unică folosință și HTTP real; plus retest țintit după corecția
istoricului. Include tenant, docs, card-periods, reliability/Postgres, harsh,
flux curse, outbox, draft bon, traduceri, demo și calcule.

Comenzi noi: `npm run smoke:driver-integrity` (cu TEST_DATABASE_URL pentru partea
PostgreSQL) și `npm run smoke:driver-integrity:http` (cere TEST_DATABASE_URL și
build existent). Aceste două suite își șterg doar firma fictivă; unele suite vechi
precum tenant/docs/card-periods refac schema: folosiți exclusiv o bază de test.

Browser: cont fictiv de șofer, navigare între /driver și /notifications, bară de
stare + acces la Privat, activare/reluare pauză, 320 px fără overflow. Browserul
nu are GPS real disponibil; nu pretindem probe pe telefoane fizice, ecran stins,
rețea mobilă sau testare end-to-end a producției.

### DEP-01 — P1 DESCHIS — actualizare majoră Next.js

Auditul npm al dependențelor de producție raportează încă Next.js 14.2.35
(critic) și PostCSS tranzitiv (ridicat). Semnalarea pachetului nu demonstrează
exploatarea acestei instalări; unele probleme depind de funcții/configurări
nefolosite aici. Optimizatorul Next de imagini, nefolosit în aplicație, a fost
dezactivat și endpoint-ul verificat 404. Drizzle a fost actualizat la 0.45.4,
eliminând alerta sa de identificatori SQL. Următorul pas necesar: migrare la o
ramură Next întreținută și corectată, adaptarea API-urilor asincrone, retest
middleware/autentificare, cache, uploaduri și build/deploy. Nu se folosește
`npm audit fix --force` fără verificarea migrării.

Surse: https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
și https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9.
Rămân deschise și OPEN-01 (telefoane reale), testele Blob în producție,
reconcilierea obiectelor Blob orfane după erori de rețea și demo-ul comun
patron/șofer documentat în rundele anterioare.

## Istoricul camionului și alegerea cursei — 17 octombrie 2026

- **HISTORY-01 rezolvat:** „Redă cursa” de pe camion nu identifica o cursă.
  Acum „Curse și trasee” deschide istoricul lunar, separat în În desfășurare,
  Planificate și Istoric. Fiecare rând arată data, ruta, clientul și șoferul
  înregistrat pe cursă, nu șoferul alocat acum camionului.
- **HISTORY-02 rezolvat:** redarea reală putea include alte curse din aceeași zi.
  Selectarea unei curse limitează punctele GPS și alimentările la intervalul
  încărcare–descărcare (până acum pentru o cursă încărcată). Capătul este exclusiv;
  două curse adiacente nu împart punctul de la începutul celei de-a doua.
  Sunt acceptate intervale peste miezul nopții, cu (+1), (+2) pe cronologie.
- **HISTORY-03 rezolvat:** fără orele cursei, interfața oferă explicit GPS-ul zilei,
  cu avertizarea că poate cuprinde alte curse. Vizualizarea zilei nu atașează
  automat o cursă/profit/șofer curent. Planificatele și anulatele nu au redare;
  lipsa a două puncte distincte este explicată fără buton care promite o hartă.
- **HISTORY-04 rezolvat:** ruta era ascunsă pe mobil; apare acum în antet, cu data,
  camionul, „Alege altă cursă” și explicația intervalului. Textul lung se încadrează,
  iar panoul explicativ apare deasupra instrumentelor hărții. Redarea pornește la
  cerere, nu automat. Ultimul punct GPS nu mai afirmă că tura s-a încheiat.
- **HISTORY-05 rezolvat:** linkurile cu o cursă/camion necunoscut sau incompatibil
  nu mai cad pe altă cursă. Accesul este limitat la firma sesiunii. Linkul vechi
  `/replay?v=…`, fără dată, duce la alegerea cursei.
- **HISTORY-06 rezolvat, prins în browser:** navigarea lunilor actualiza lista,
  dar câmpurile native de lună/zi puteau păstra valorile vechi. Formularele se
  recreează la schimbarea lunii. O lună viitoare nu precompletează o zi GPS
  viitoare, invalidă față de limita formularului.

Verificări: build producție, TypeScript, `smoke:truck-history`, `smoke:demo`,
`smoke:driver-trips` și `smoke:truck-history:http` pe PostgreSQL de test. Suita HTTP
își șterge doar firmele fictive. Verifică selecția explicită, izolarea între firme,
filtrul lunar, excluderea planificatelor și prioritatea intervalului cursei față de
un parametru de zi contradictoriu. Next poate transmite redirect/404 în fluxul
HTML după layout; testul verifică și această formă, fără a presupune doar statusul HTTP.

Browser: două curse în aceeași zi cu alt șofer istoric, cursă peste miezul nopții,
zi completă separată, demo retur München–Viena și filtru fără rezultate.
Verificări de layout la 320/390 px și desktop; date GPS sintetice, fără probe
de deplasare cu telefon real.

### Probleme rămase observate

- **GPS-TIME-01 — P2 DESCHIS:** pozițiile vechi sunt salvate ca oră locală București,
  la minut, fără offset. Ora repetată la trecerea la iarnă nu poate fi reconstruită
  neechivoc. Migrare necesară la capturedAt UTC + receivedAt + precizie, înainte de
  colectorul mobil și de sincronizarea pozițiilor offline; nu se inventează precizia
  datelor deja existente. GPS-ul din interval nu este o asociere verificată punct–cursă.
- **UI-PREF-01 — P2 DESCHIS:** linkul de schimbare a temei din Header înlocuiește
  parametrii URL; pe replay poate pierde cursa selectată, iar pe istoric luna.
  De refăcut cu păstrarea parametrilor, împreună cu verificarea preferințelor.
- DEP-01 și limitările de dispozitiv/Blob/demo comun de mai sus rămân deschise.

## Runda 19 — Next.js 16, UTC și pilot mobil — 17 octombrie 2026

Acest status înlocuiește statusurile DEP-01 și UI-PREF-01 de mai sus.

- **DEP-01 REZOLVAT pentru runtime web:** Next 16.4.2, React/React DOM 19.3.1;
  API-uri cookies/headers/params/searchParams asincrone, middleware migrat la proxy.
  `npm audit --omit=dev`: 0 vulnerabilități la verificarea acestei runde.
  Regresia descoperită la migrare (`vehicles` serializat ca Promise în API live demo)
  a fost reparată și confirmată de testul de schimbare rol/pauză privată.
- **UI-PREF-01 REZOLVAT:** tema păstrează întreaga adresă, filtrele și fragmentul.
  Verificat în browser: `replay?trip=bh21qrt-15` păstrează trip după schimbarea temei.
  Butonul din meniul mobil are stil explicit, fără bordura implicită de browser.
- **GPS-TIME-01 REZOLVAT pentru punctele noi:** migrarea 0018 păstrează capturedAt
  UTC, receivedAt UTC și precizia. Punctele vechi rămân nealterate; offsetul lor
  original nu poate fi inventat. Replay filtrează punctele noi prin UTC, păstrează
  secundele și afișează offsetul. Testate ora repetată din 25 octombrie 2026,
  limite locale inversate și puncte din secunde diferite ale aceluiași minut.
- **MOBILE-01 IMPLEMENTAT CA PILOT:** proiect Expo/React Native separat în
  apps/driver, aceeași bază de date și verificări de atribuire ca web. Login cu
  telefon/PIN, token separat de cookie, 12 h, domeniu HTTPS configurat la build,
  SecureStore, comenzi de tură, Privat, listă de curse în șase categorii.
- **MOBILE-02 TESTAT ÎN LOGICĂ ȘI HTTP:** colector nativ cu acord explicit,
  serviciu Android/indicator iOS, filtre precizie/vârstă, oprire la modificarea
  turei/camionului, expirare/revocare cont. Privat/oprit dezactivează local GPS
  înainte de rețea; comanda de control rămasă se reîncearcă. Nu există outbox GPS
  în această etapă: lipsa internetului produce goluri declarate, nu retransmitere
  de puncte private sau vechi.

Validare: 21 suite existente, 394 linii PASS, fără FAIL/SKIP; separat teste HTTP
mobile (3 grupuri), colector nativ cu platforma simulată (2 grupuri), replay UTC
(4 grupuri), istoric HTTP (2 grupuri). Build Next și TypeScript trec. Exporturile
Hermes Android/iOS și generarea proiectelor native prin Expo prebuild trec.
Acestea NU echivalează cu compilarea APK/IPA sau probe de GPS fizic.

### Restanțe / criterii de lansare mobilă

| ID | Prioritate | Stare și următorul test |
| --- | --- | --- |
| MOBILE-DEVICE-01 | P1 | Fără Xcode complet, JDK/Android SDK și telefon conectat. ADB 37.0.1 funcționează din folderul oferit de utilizator. Sunt obligatorii probele din NATIVE-DRIVER.md înainte de activarea pilotului. |
| MOBILE-DEP-01 | P1 | Auditul arborelui Expo raportează 22 intrări (15 high, 7 moderate), inclusiv propagarea acelorași advisories. Rădăcini: braces ≤3.0.3, node-forge ≤1.4.0, uuid <11.1.1, în principal în instrumentele Metro/config/build. Nu s-a forțat downgrade-ul Expo sugerat de npm. Necesită remediere/analiză înainte de distribuția generală; auditul web 0 nu acoperă proiectul mobil. |
| MOBILE-OFFLINE-01 | P2 | Outbox GPS criptat, deduplicare și autorizare pe interval istoric încă neimplementate. În pilot se trimit doar puncte proaspete, când există rețea. |
| MOBILE-FLOW-01 | P2 | CMR/POD, bonurile și evenimentele cursei rămân în web; lista nativă este deocamdată pentru consultare. |
| MOBILE-SESSION-01 | P2 | Tokenul expiră la 12 h și este revocat prin schimbarea PIN/dezactivare cont. Managementul și revocarea individuală a dispozitivelor/refresh token nu există încă. Logout șterge tokenul local și oprește GPS; nu încheie automat tura. |
| GPS-LEGACY-01 | P2 | Pozițiile istorice fără UTC și orele alimentărilor fără offset rămân ambigue la DST. Nu se declară asociere verificată punct–cursă. |
| REACT-19-01 | P2 | 45 avertismente lint: 41 diagnostice noi pentru pregătirea React Compiler, 4 avertismente imagini/hooks. Compiler nu este activat; regulile sale noi rămân vizibile ca warning, Rules of Hooks rămân error. Necesită refactorizare dedicată, nu sunt declarate rezolvate. |

Limitările anterioare pentru Blob, date demo între dispozitive și probe fizice
rămân deschise. Nu s-a publicat aplicație în App Store/Google Play.

Verificare suplimentară GPS-TIME: harta live și orele turei folosesc timpul UTC
pentru punctele noi și miezul nopții calculat cu offsetul de la începutul zilei,
nu offsetul de la prânz. `smoke:gps-time` confirmă ambele tranziții DST, intervalul
de 30 secunde, ordinea punctelor și excluderea distanței necunoscute peste goluri
de peste 15 minute.

## Runda 20 — comenzi offline, confidențialitate și curse de execuție — 17 octombrie 2026

Audit de cod, defecte reproduse prin teste ale modulelor reale, HTTP cu PostgreSQL
de unică folosință și browser cu șofer fictiv. Nu s-au folosit date de producție.

| ID | Prioritate | Problemă și remediere |
| --- | --- | --- |
| CONTROL-ACCOUNT-01 | P1 rezolvat | Comanda offline nu identifica utilizatorul/backendul. Coada și autorizarea GPS sunt acum separate după origin + firmă + utilizator; tokenul nu este trimis altui backend. Revenirea în contul inițial reia doar comenzile lui. |
| CONTROL-SHIFT-01 | P1 rezolvat | O încheiere/privatizare întârziată putea afecta tura următoare a camionului. Comanda identifică începutul turei; API-ul nativ îl cere obligatoriu, iar web îl transmite. Comenzile obsolete sunt respinse și retrase din coada nativă. |
| CONTROL-RACE-01 | P1 rezolvat | Confirmarea unei cereri vechi putea șterge o comandă mai nouă. Un singur expeditor per cont și ștergere după ID exact; o comandă Privat nu mai înlocuiește o încheiere de tură offline pentru aceeași tură. Oprirea GPS anulează numai cererile GPS, nu comenzile de control. |
| GPS-STOP-01 | P1 rezolvat | Un rezultat întârziat al dialogului de permisiuni putea reactiva GPS după oprire. Invalidare imediată a operațiilor în curs, inclusiv înaintea așteptării unui refresh; callbackurile vechi nu trimit și nu afișează confirmări noi. |
| GPS-STORAGE-01 | P1 rezolvat | Eroarea scrierii stării locale putea împiedica oprirea serviciului nativ. Oprirea sistemului se execută și la eroare de stocare; datele locale corupte nu sunt interpretate ca lipsă de restricții. Ecranul de autentificare nu mai rămâne blocat la citirea SecureStore. |
| WEB-PRIVACY-01 | P1 rezolvat | După eșecul cererii Privat/stop, pollingul putea reporni GPS. Oprirea locală persistă separat per cont, între navigări, reîncărcări și taburi; reluarea este explicită. Eroarea stocării locale menține oprirea. |
| CONTROL-UX-01 | P2 rezolvat | Cererile fără termen-limită blocau comenzile; un răspuns HTML de autentificare putea fi confundat cu succesul. Timeout 12 secunde, verificare JSON/ok și mesaje corecte. Eșecul Privat nu mai afișează eroarea despre litri/km. |
| GPS-DISTANCE-01 | P2 rezolvat | Staționarea cu puncte GPS proaspete era confundată cu un gol de semnal >15 minute; salturile imposibile sub 500 m puteau crește kilometrii. Punctele staționare păstrează continuitatea temporală, iar filtrul de viteză se aplică și salturilor scurte. Golurile reale nu primesc distanță inventată. |
| DRIVER-STATE-01 | P2 rezolvat | Checklistul nativ putea rămâne bifat după schimbarea camionului/turei; starea locală nu se actualiza la eroare de rețea. Checklistul se resetează la schimbarea contextului, ultima confirmare GPS include data și avertizează după 90 secunde. În web, mesajul de căutare GPS nu mai contrazice oprirea locală; butonul de reluare are rând separat. |

### Validare și reproducere

- 21 suite de regresie existente: **394 linii PASS, fără FAIL/SKIP**. Bază PostgreSQL
  separată; suitele care refac schema nu se rulează niciodată pe producție.
- `smoke:mobile:http`: autentificare, identitatea contului, separarea bearer/cookie,
  protejarea datelor financiare, UTC, Privat/stop, ture obsolete și revocare.
- `smoke:native-tracking`: platformă simulată, dar modulele aplicației executate;
  offline, cont schimbat/revenire, ACK întârziat, prioritate stop, eroare de stocare,
  oprire în timpul permisiunilor, puncte vechi/inexacte și atribuire schimbată.
- `smoke:native-api`: anulare selectivă GPS, origine/cont, expirare invalidă,
  JSON local corupt și coduri de eroare. `smoke:driver-control`: persistența
  opririi, izolare per cont, stocare indisponibilă, timeout și redirect HTML.
- `smoke:gps-time`: DST, UTC, staționare cu semnal, goluri reale și salt scurt
  imposibil. Build Next, typecheck nativ și export Hermes iOS/Android reușite.
- Browser: șofer real în firma fictivă; server local oprit în timpul cererii
  Privat, revenire conexiune, pagină nouă cu oprirea păstrată și reluare explicită;
  layout la 320/390 px fără depășirea lățimii paginii. Istoric camion HTTP: 2 grupuri PASS.
  GPS indisponibil în browserul de test; nu este o probă de poziționare fizică.
- Lint: 0 erori, aceleași 45 avertismente cunoscute din runda 19.

### Restanțe păstrate explicit

MOBILE-DEVICE-01 rămâne P1: Xcode este acum instalat, dar configurarea/licența
Apple nu este finalizată de utilizator; ADB funcționează, fără telefon conectat
la verificare. Exportul JavaScript/Hermes nu este APK/IPA și nu validează GPS
cu ecranul blocat. Pilotul rămâne dezactivat implicit.

MOBILE-DEP-01, MOBILE-OFFLINE-01, MOBILE-FLOW-01, MOBILE-SESSION-01,
GPS-LEGACY-01, REACT-19-01 și probele Blob/demo comun din rundele anterioare
rămân deschise. Nu s-au schimbat dependențele în această rundă.

Coada veche de pilot, fără identitatea contului, nu este retransmisă automat:
nu poate fi atribuită sigur unui utilizator. Un pilot instalat din versiunea
anterioară necesită reautentificare și verificarea turei; nu există încă
distribuție publică. În timpul unei alte operații native, un buton de oprire
oprește GPS local imediat; dacă operația este deja blocată de alta, UI cere
reîncercarea comenzii server după finalizarea ei. Acest caz trebuie inclus în
probele pe telefon, împreună cu limitele de baterie/permisiuni ale sistemului.


## Runda 21 — pregătire iPhone și comenzi în timpul cererilor lente — 17 octombrie 2026

Utilizatorul a cerut focus iPhone și pregătirea buildului fără telefon disponibil.
Android nu a fost testat fizic în această rundă.

| ID | Prioritate | Rezultat |
| --- | --- | --- |
| IOS-CONTROL-01 | P1 rezolvat în logică | În runda 20, o acțiune Privat/stop în timpul altei cereri necesita repetarea comenzii server. Acum oprirea și salvarea se fac imediat, iar sincronizarea așteaptă automat cererea precedentă. Pornirile GPS care încă așteaptă sunt invalidate; apăsările normale duplicate sunt ignorate. |
| IOS-PENDING-01 | P2 rezolvat în UI | Se afișează explicit comanda fără confirmare, iar pornirea GPS este indisponibilă cât timp există această comandă. Starea locală se reîncarcă imediat după oprire și după finalizarea operației. O sincronizare reușită elimină eroarea veche de rețea. |
| IOS-PERMISSIONS-01 | P2 corectat în configurare | Mesajele de localizare sunt în română, inclusiv cererea de precizie completă. Aplicația nu folosește biometrie sau Motion: declarațiile Face ID și Motion sunt eliminate prin pluginurile oficiale, iar modulul Motion este dezactivat la compilare. |
| IOS-BUILD-CONFIG-01 | P1 prevenit | Scriptul de build refuză lipsa backendului, domenii placeholder, HTTP, credențiale și path/query în origin. Loginul diferențiază datele greșite de sesiunea expirată și de pilotul mobil dezactivat. |
| MOBILE-DEP-01 | P1 parțial rezolvat | `xcode` folosește acum `uuid` 11.1.1. Auditul scade de la 22 la 15 intrări: 0 moderate, 15 high, 0 critical. Cele 15 provin din două advisories rămase, cu propagarea prin arbore; nu sunt 15 probleme independente. |

### Verificări executate

- `smoke:native-actions`: oprire/salvare înaintea unui ACK blocat, sincronizare
  automată ulterior, apăsări duplicate, anularea pornirii care așteaptă refresh,
  recuperarea după eroare de stocare.
- `smoke:native-tracking`: toate cele patru grupuri trec; offline, izolare de cont,
  ACK întârziat, prioritatea încheierii turei, erori SecureStore și permisiuni întârziate.
- `smoke:native-api`: anulare selectivă, origine/identitate/expirare, stocare coruptă,
  coduri server; mesaje distincte pentru pilot dezactivat și credențiale greșite.
- TypeScript nativ și export Hermes iOS reușite. Sursa exportului conține 634 module;
  niciun modul din braces, node-forge, uuid, xcode sau micromatch. Există loaderul
  `@expo/cli/build/metro-require/require.js`; această verificare nu declară întregul
  pachet CLI absent și nu înlocuiește auditul instrumentelor de dezvoltare.
- Compatibilitatea override-ului uuid: Expo prebuild, 1.000 de ID-uri Xcode unice
  în formatul așteptat și citire → scriere → recitire a proiectului generate cu succes.
- Validatorul de build acceptă originul HTTPS și respinge origin lipsă,
  placeholder, HTTP, credențiale și path.

### Dependențe rămase deschise

La verificare, nici [braces ≤3.0.3](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
nici [node-forge ≤1.4.0](https://github.com/advisories/GHSA-86w9-cpqp-85rv) nu au o
versiune corectată publicată. Braces este în lanțul Metro/micromatch; node-forge
în instrumentele Expo CLI și de certificate. Nu forța downgrade-ul Expo sugerat
de `npm audit fix --force`; nu expune serverul Metro în rețele publice și nu folosi
certificate/configurații de proiect din surse necunoscute. Repetă auditul înainte
de distribuție și actualizează când există versiuni compatibile corectate.
Această analiză restrânge suprafața afectată; nu închide MOBILE-DEP-01.

### Arhiva iPhone verificată

- Xcode 27.1 / CocoaPods 1.17.0: `ARCHIVE SUCCEEDED`, Release pentru dispozitiv
  arm64, fără semnare. Versiune 0.1.0 (1), minimum iOS 16.4. Sursa `d42964d`,
  arbore curat; ora buildului: 2026-10-17T16:07:33Z.
- Verificate în arhivă: executabil Mach-O arm64, `main.jsbundle` Hermes cu
  originul HTTPS corect, `Assets.car` și pictograma de aplicație, modul background
  location, ATS fără arbitrary loads, absența declarațiilor Face ID/Motion.
  Configurația compilată ExpoLocation include `EXPO_LOCATION_DISABLE_MOTION`.
- Arhivă aproximativ 60 MiB. ZIP local:
  `apps/driver/build/ios/device/QuerraSofer-iPhone-0.1.0-unsigned.zip`.
  SHA-256: `45640fcde1add54481e4eba9258e539ffaaf0d4a03627d63978075729f9734cc`.
- Backendul public verificat răspunde `404 mobile-unavailable` la cererea de
  autentificare mobilă fără credențiale. Nu s-a activat pilotul și nu s-au trimis
  credențiale reale. TypeScript pentru aplicația web trece și el.
- **IOS-NATIVE-WARN-01, P2 deschis:** buildul reușește cu 821 apariții de warning
  (189 mesaje distincte, multe repetate pentru aceleași headere). Categoriile
  principale sunt nullability/umbrella headers React, API-uri legacy, Sendable
  în dependențe Swift și globale furnizate de runtime în compilarea Hermes.
  Nu s-au dezactivat avertismentele. Warningul despre CoreModule intern este
  verificat în sursă: AppContext îl instanțiază direct. Rămân necesare testarea
  pe telefon și evaluarea actualizărilor compatibile Expo/React Native; succesul
  compilării nu dovedește compatibilitatea tuturor fluxurilor la rulare.
- Nu există rezultat UI din simulator: descărcarea runtime-ului de 7,85 GB a
  fost oprită pentru a prioritiza arhiva iPhone. Nu s-au făcut teste fizice.

### Restanțe iPhone

- MOBILE-DEVICE-01: configurarea Xcode funcționează acum; CocoaPods este instalat
  separat de Ruby-ul sistemului. Telefonul nu este disponibil. Semnarea Apple,
  probele GPS cu ecran blocat/deplasare, baterie, permisiuni și VoiceOver rămân
  obligatorii înainte de utilizare operațională.
- MOBILE-OFFLINE-01, MOBILE-FLOW-01 și MOBILE-SESSION-01 rămân deschise conform
  matricei anterioare. Nu există încă outbox pentru puncte GPS, documente/evenimente
  native complete sau gestionarea individuală a sesiunilor per telefon.
- Pilotul rămâne dezactivat implicit în backend. Nu s-a publicat în App Store și
  nu s-au folosit conturi ori date de șoferi reali pentru aceste verificări.

## Runda 22 — pregătire Android și probă nativă în emulator (17 octombrie 2026)

### Remedieri și build

- Toolchain local instalat: Temurin JDK 17, Android SDK 37/Build Tools 37.0.0,
  NDK 27.1.12297006, emulator Google Play Android 36.1 arm64.
- Script reproductibil `android:check` / `android:build:preview`; APK Release
  semnat cu o cheie privată de test în afara repository-ului, identitate separată
  `com.querra.qfleet.driver.preview`. Nu folosește cheia debug standard.
- Android 13+: cerere explicită POST_NOTIFICATIONS înainte de GPS. Refuzul
  notificărilor blochează pornirea; aprobarea întârziată nu poate anula Stop.
- Dezactivate backup-ul Android, traficul HTTP în Release și permisiunile
  nefolosite de stocare, microfon și overlay. Tema dark are modulul SystemUI.
- Defect observat pe emulator 360×640 dp: tastatura acoperea PIN-ul. Formularul
  deplasează acum câmpul activ deasupra tastaturii pe Android; autentificarea
  închide tastatura și revine la zona mesajelor de eroare.
- Build final: sursa `ad9eab5`, 2026-10-17T17:18:39Z; numai cele două documente
  QA/ghid aveau modificări necomise (`sourceDirty: true`), codul era comis;
  `BUILD SUCCESSFUL` (3m 5s la reconstruire). APK aproximativ 38.1 MiB.
  SHA-256: `dfe7ab635a422c3c45ce47b9c516d46a8ec87fb73dc3fbab5a8ac980b85c1c51`.
  Certificat public SHA-256:
  `3b8b380f582ea6d8d562f5e924c1b964fab31dab17dcd207036b0e9e0064a2e6`.

### Verificări executate

- TypeScript nativ, smoke native-tracking (5 grupuri), native-actions și
  native-api: PASS. Include refuz/acord notificări, acord întârziat după Stop,
  Android 12 fără cererea de notificări Android 13.
- Validator origine HTTPS: acceptă originul valid, respinge lipsă/placeholder/
  HTTP/credențiale/path/query/hash. Export Hermes Android reușit, 632 surse;
  fără module braces/node-forge/uuid/xcode/micromatch în exportul verificat.
- APK final: semnătură verificată și certificat identic cu cheia preview;
  non-debuggable, bundle JS și backend HTTPS incluse, permisiuni verificate.
  `zipalign -c -P 16 4` PASS; toate cele 34 biblioteci ELF64 au segmentele LOAD
  aliniate la minimum 16 KB. Acesta este un control static, nu test pe OS 16 KB.
- Primul APK: instalare în emulator, lansare fără Metro, mesajul explicit
  `mobile-unavailable`, layout login la font normal și font_scale 2.0: PASS.
  Formularul rămâne derulabil, fără overflow lateral observat. Defectul PIN de
  mai sus a fost găsit în această probă; nu declarăm toate ecranele validate.

- APK final: reinstalare cu aceeași semnătură, cold launch fără Metro, PIN
  vizibil deasupra tastaturii, buton accesibil prin derulare, apăsare login cu
  închiderea tastaturii și afișarea mesajului serverului: PASS. Bufferul Android
  de crash este gol după această probă. Nu s-au introdus credențiale reale.
- Emulatorul a avut o blocare QEMU la o repornire intermediară; proba finală a
  fost repetată după cold boot cu 2 nuclee/1536 MB. Incident de mediu, cauză
  neconfirmată; nu este prezentat drept test de stabilitate pe telefon.

### Restanțe / criterii de lansare

- **MOBILE-DEVICE-01, deschis:** nicio probă pe Android fizic. Trebuie verificat
  GPS 30 minute în deplasare cu ecranul blocat, notificarea serviciului,
  refuz/revocare permisiuni, baterie/economisire, offline/reconectare, Privat,
  sfârșit de tură, force-stop/restart și recepția pe harta patronului.
- **MOBILE-STAGING-01, deschis:** backendul inclus în APK rămâne cu pilotul
  dezactivat; autentificarea reală, dashboardul și traseul complet n-au fost
  validate în emulator. Pregătește staging HTTPS, activează flagul acolo,
  creează șofer/camion de test și reconstruiește APK-ul pentru acel origin.
- **ANDROID-COMPAT-01, deschis:** APK numai arm64-v8a/x86_64; 32-bit neacoperit.
  Minimum declarat API24, target36; emulator testat API36.1. Rămân versiuni
  mai vechi, dispozitive Samsung/Xiaomi, TalkBack și ecranele autentificate.
- **ANDROID-NATIVE-WARN-01, P2:** avertismente API legacy în dependențe și
  MainActivity generat; avertisment de incompatibilitate viitoare Gradle 10.
  Nu sunt suprimate. Buildul reușit nu închide evaluarea actualizărilor.
- **MOBILE-DEP-01** rămâne deschis: npm audit are 15 high propagate din cele
  două advisory-uri documentate în runda 21. Nu s-a folosit `audit fix --force`.
- **MOBILE-OFFLINE-01 / MOBILE-FLOW-01 / MOBILE-SESSION-01** rămân deschise:
  fără outbox GPS, fără CMR/POD/evenimente native complete, fără revocare
  individuală per telefon sau reînnoire automată a tokenului.
- Nu s-a publicat în Google Play și nu există AAB/semnare de producție.
  Arhiva iPhone anterioară rămâne nesemnată și nu include corecțiile acestei runde.

## Runda 23 — căutare curse pe Mac și telefon (17 octombrie 2026)

- Înlocuit grila generică a filtrelor cu layout dedicat: căutare prioritară,
  filtre aliniate pe desktop, câmpuri pe coloană pe telefon, săgeți vizibile
  pentru selectoare, buton principal și resetare numai când există filtre.
- Selectorul lunii este acum un select nativ cu lunile curselor disponibile;
  păstrează și luna validă primită prin URL. Nu depinde de aspectul input month
  între browsere. Căutarea include deja clientul; noul placeholder îl explică.
- Metadata Apple: nume aplicație web și apple-touch-icon explicit.
- PASS: TypeScript, ESLint pe fișierele TSX schimbate, smoke-trip-workflow.
- PASS în browser: desktop 1440×1000, mobil 390×844 și lățime 320 fără overflow
  al paginii; câmpuri de 50 px și butoane de minimum 48 px. Milano + Planificată
  → 2 rezultate; luna octombrie păstrează 2; resetare → 70. Enter cu termen
  inexistent → 0 și mesaj explicit. Nu s-au folosit date reale.
- Proba Safari locală a revenit la login după demo în sesiunea de test; cauza
  nu este confirmată. Nu modificăm securitatea autentificării pentru acest test.
  Verificarea HTTPS în Safari și proba fizică iPhone se urmăresc separat.
- Următoarele priorități Apple: tastatură/VoiceOver și text mărit pe iPhone real;
  flux creare cursă și documente în Safari; onboarding GPS nativ cu permisiuni
  și test ecran blocat. Nu declarăm întregul produs validat prin această rundă.
- Publicare `078261f`: Vercel SUCCESS, widgetul nou confirmat pe HTTPS în
  browserul integrat. **APPLE-SAFARI-01, deschis:** în Safari-ul instalat,
  sesiunea existentă admin/demo afișează antetul, dar conținutul rămâne în
  skeleton inclusiv la navigarea directă `?q=Milano`. Nu există încă diagnostic
  care să separe sesiunea, setările browserului și încărcarea aplicației.
  Nu marca acceptarea Safari drept PASS; acesta este următorul blocaj de verificat.

## Runda 24 — buton integrat în căutare (17 octombrie 2026)

- Control comun SearchField pentru Șoferi, Curse și lista demo: lupă în stânga,
  buton Caută în interior în dreapta, etichetă asociată explicit câmpului.
- Pe desktop, căutarea curselor ocupă un rând, cu cele trei filtre dedesubt.
  Pe telefon, câmpul și butonul rămân împreună; țintă tactilă de 44 px.
- PASS: TypeScript, diff check; ESLint fără erori. Avertismentul existent
  react-hooks/purity pentru Date.now în invitații rămâne separat.
- PASS în browserul integrat: 1440, 390 și 320 px fără overflow orizontal;
  Rotterdam prin buton → 10 curse; Ioan prin Enter → Ioan Pop în demo.
- Pagina reală de șoferi folosește același control, dar nu a fost verificată
  cu un cont real. Testele responsive nu înlocuiesc proba fizică iPhone.
  APPLE-SAFARI-01 rămâne deschis; această schimbare nu îi confirmă rezolvarea.

## Runda 25 — valori înaintea barelor și recalculare (17 octombrie 2026)

- Venit, motorină, celelalte costuri și profit: valoarea precede bara; pe mobil
  eticheta și valoarea sunt deasupra ei. Aplicat și la categorii de alimentări,
  economii, comparație flotă și clasamentul camioanelor. Eliminat scrollul
  orizontal din graficul estimărilor de economii.
- Formularul de preț/tonaj are titlu, câmpuri aliniate și buton principal;
  pe telefon butonul ocupă un rând, cu nota demo separată dedesubt.
- PASS: TypeScript, diff check; ESLint fără erori, avertisment img existent
  în detaliul cursei.
- Browser demo: toate cele 11 valori din defalcarea cursei preced bara și
  încap la 320, 390 și 1440 px. Economii: 3 rânduri încap la 320 px;
  comparație flotă: 7 rânduri încap la 320 px.
- Formular: verificare vizuală la 390 px și aliniere desktop. Recalculare
  demo 4880 → 5000 lei: venit 5000, profit 1517; restaurat prețul 4880.
- Nu reprezintă validare pe iPhone fizic sau închiderea APPLE-SAFARI-01.

## Runda 26 — formulare flotă și carduri alimentări (17 octombrie 2026)

- Camioane reale: SearchField comun cu buton integrat, filtru de stare separat;
  formularul GET păstrează q și archived.
- Atribuire camion/șofer: selector și Salvare aliniate pe desktop, buton lat pe
  telefon. Curse și trasee devine acțiunea principală în cardul camionului.
- Alimentări reale și demo: eliminată lățimea minimă de 600 px; carduri mobile
  cu litri/sumă sus, stație/data/camion și stare vizibilă dedesubt. Corectată
  regula veche care ascundea coloana stării pe telefon.
- Costuri camion: unitățile sunt sub input, fără suprapunere cu cifrele.
- PASS: TypeScript, diff check, ESLint fără erori; avertismentul Date.now
  din invitații rămâne existent.
- Browser demo: 49 alimentări încap la 320/390/1440 px; toate cele 49 de stări
  sunt vizibile pe mobil. Cele 11 câmpuri de cost încap la aceleași lățimi,
  cu unitățile sub câmp. Captură vizuală verificată la 390 px.
- Formularele exclusive contului real au fost verificate în cod și TypeScript;
  atribuirea și filtrarea într-un cont real rămân de verificat funcțional.
  Nu s-au modificat datele vreunei flote reale. iPhone fizic neacoperit.

## Runda 27 — pregătire pilot Apple (17 octombrie 2026)

- Comandă reproductibilă: `npm run check:pilot -- --postgres --http`, după build
  și cu TEST_DATABASE_URL explicit către o bază dispensabilă. Migrațiile se
  aplică înaintea suitelor; DATABASE_URL al aplicației nu este folosit de teste.
  Fără opțiuni, raportul marchează verificarea ca parțială.
- PASS: **29/29 suite**, inclusiv PostgreSQL și HTTP pe build de producție,
  pe baza locală izolată qfleet_pilot_20261017, fără date reale.
- Acoperire: calcule financiare, conversii valutare, concurență invitații și
  atribuiri, izolare firme, schimbare stare cursă și jurnal atomic, retry POD
  fără dubluri, istoric camion, GPS privat/oprit, comenzi offline vechi și
  revocarea sesiunilor mobile. GPS: inclusiv 20.000 poziții cu aceeași oră.
- Prima rulare harsh pe baza nouă nu avea schema; după migrare a trecut.
  Scriptul pilot previne această ordine greșită. Nu a fost un bug al aplicației.
- Build de producție PASS; lint noului error boundary PASS. Avertismentul
  preferredRegion depreciat rămâne existent în build.
- APPLE-SAFARI-01: reprodus pe HTTPS înaintea schimbării. Eliminat loading.tsx
  global pentru ca paginile operaționale să nu depindă de înlocuirea skeletonului
  prin scriptul de streaming. Compromis: se așteaptă conținutul la navigare în loc
  de skeleton global imediat. Cauza exactă din Safari nu este confirmată.
- Safari macOS local: demo login, lista Curse și căutare Milano → 10 rezultate
  confirmate după schimbare. Proba HTTPS după deploy și iPhone fizic rămân
  criterii separate; rezultatul local nu închide singur APPLE-SAFARI-01.
- Adăugat error boundary de pagină cu retry și întoarcere Acasă, fără mesajele
  interne ale serverului; avertizează să verifici lista înainte de retrimitere.
- OWNER-GUIDE.md include scenariul de pilot 19–25 octombrie, pașii patron/șofer,
  probele offline/GPS și criteriile de oprire. Nu s-au creat conturi reale și nu
  s-au trimis invitații. iPhone semnat/dispozitiv, două dispozitive simultane și
  livrarea reală de invitații rămân de validat înaintea acceptării pilotului.
- Verificare după publicarea fe04014: **Safari macOS HTTPS PASS pentru cazul
  reprodus** — /trips?q=Milano afișează 10 rezultate; trimiterea formularului
  cu Rotterdam afișează cele 10 curse corecte. APPLE-SAFARI-01 este mitigat
  pentru acest caz, fără a pretinde identificarea cauzei interne a browserului
  sau acceptare iPhone. Captură: /tmp/qfleet-safari-pilot.png (locală).
- Captura vizuală a evidențiat o a doua cauză de conținut ascuns: animația fade
  pornea la opacity:0. Textul și cardurile sunt acum vizibile din primul cadru,
  chiar când animația este suspendată. Citirea AX singură nu dovedea vizibilitatea.

## 2026-10-18 — Trip actions and driver route readability

- Moved trip replay actions out of absolute positioning into layout flow. Mobile cards retain a labeled 44px action below the summary; desktop uses a separate grid column.
- Renamed replay entry to GPS route in RO/EN/PL, hid it for unstarted planned and cancelled trips. This is not proof that GPS points exist: replay still handles missing data.
- Grouped trip detail replay/duplicate/edit actions, with consistent secondary buttons, icons and wrapping. Duplicate/edit remain owner/admin-only and real-firm-only.
- Driver route shows departure, intermediate places and destination; the highlighted active trip no longer repeats in the Now list. Existing assignment, status and POD grouping retained.
- Added explicit real-trip warning for zero recorded tolls: zero is not an automatic toll quote or evidence of payment.
- Passed TypeScript; smoke-driver-trips, smoke-i18n and smoke-truck-history. Browser: trip list at 320/390/1280px without document horizontal overflow; replay buttons do not intersect summaries at 390/1280px. Inspected driver mobile screenshot and desktop trip detail. Real-firm duplicate/edit browser flow and physical iPhone remain unverified in this round.

### Remaining: road toll integration

- Existing implementation: per-trip recorded toll amount, fixed-cost vignette field, document expiry tracking; demo toll amounts are fictional. No toll quoting/payment connector found.
- Proposed first release: truck profile (MTMA, axles, Euro/CO2 class where required, dimensions), geocoded route and departure time, truck routing/toll provider, quote timestamp/currency/coverage/source. Unknown price must remain unknown, never silently zero.
- Keep estimates, imported settled charges and payment evidence separate. Avoid charging the same vignette as both a trip fee and an allocated fixed cost. Dedupe provider toll fare IDs across route sections.
- Compare total costs (tolls + estimated fuel + additional time), not tolls alone. Show projected savings separately from reconciled actual costs. Do not claim theft, fuel consumption or legal driving-time compliance from phone GPS.
- Integration needs a licensed provider account/server secret and validation of current country coverage, particularly TollRo; route estimation does not authorize payment. Automatic purchase requires a separately contracted payment/toll provider and transaction confirmation/reconciliation.

## 2026-10-18 — TollRo external handoff (API integration still blocked)

Added a collapsed TollRo panel on owner trip detail, selected driver trip and driver document detail. It displays/copies the trip's own truck/route/date and links to the official portal without sensitive query parameters or referrer. Cancelled trips excluded, demo warning, clipboard fallback, RO/EN/PL labels. It explicitly does not start TollRo, calculate/pay fees or verify payment. No database/payment changes.

Remaining external blocker: official provider API contract and sandbox/production access, see TOLLRO-INTEGRATION.md. Do not advertise this handoff as automatic TollRo integration.

## 2026-10-18 — Delivered trip still showed Continue trip

Fixed:
- Demo event success updated TripPaperwork only. DriverTrips now receives demo-only confirmed load/unload/POD changes and recomputes current selection, counters and selected tab immediately. Production data remains server-authoritative.
- Closed historical trips carrying loadedAt but no deliveredAt were classified as running. Explicit planned=false now takes precedence over loadedAt (delivered trips missing POD still remain actionable in documents).
- POD upload did not refresh the board immediately. Real uploads now refresh server data; demo uploads project POD state locally.
- Paperwork header could continue saying current trip after unloading. It now reflects local delivery state, retaining server labels for read-only/cancelled contexts. A delivered trip cannot offer loading even if loadedAt is absent.
- Shift-end confirmation explicitly distinguishes ending GPS/shift from recording unloading; multi-day trips must not be auto-completed by shift end.

Validation: TypeScript, driver-trips (new unload/POD/stale-event/closed-history regressions), trip-workflow, outbox, i18n, driver-integrity (memory), driver-control passed. Browser reproduced demo unload: Continue trip absent, Now 0, Delivered count 7->8, missing-POD reminder and delivered paperwork header. Screenshot /tmp/qfleet-delivered-state-fixed.png.

Remaining: demo changes remain page-local and reset on reload as disclosed. Real PostgreSQL checks skipped without TEST_DATABASE_URL; two-device delivery/POD synchronization remains a manual pilot check. The outbox can briefly reapply old initial state when an acknowledged event leaves the queue before refreshed server props arrive; pending/blocked events remain disclosed, but this refresh-boundary behavior needs a separate reconciliation test.

## 2026-10-18 — Document compliance, cleanup and harsh QA

This round supersedes the PostgreSQL test limitation above for the suites rerun below. It does not close the physical-device or two-device pilot checks. All test accounts, CSVs and PDFs were fictitious and local; no production records were deleted.

| ID | Priority | Defect / gap | Fix and evidence |
|---|---|---|---|
| COMP-01 | P1 | Missing RCA/ITP absent from expiry-only lists | Fleet dashboard creates required rows even when no document exists; unknown never becomes valid. Pure tests and browser. |
| COMP-02 | P1 | Future renewal could appear valid; replaced/archived documents continued alerting | Effective-date selection shared by reminders, alerts and home; calendar excludes superseded vehicle records and inapp notices hide stale documents. PostgreSQL and date/DST regressions. |
| COMP-03 | P1 | Rovinietă could be treated as relevant for heavy freight without a regulatory profile | Category/MTMA validation, explicit unknown data, separate electric propulsion; TollRo remains unverified per journey. Threshold/bus/unknown tests. |
| COMP-04 | P1 | New driver client card initially received all fleet document props | Scoped before serialization. HTTP checks assert another vehicle's unique note is absent from the driver response. |
| COMP-05 | P1 | Assigned vehicle PDF was inaccessible to driver; access could remain cached after reassignment | Tenant + current assignment or personal ownership checks; no-store response. HTTP verifies 200 for assignee, 404 for other firm, 403 after unassignment. |
| COMP-06 | P1 | CSV could overwrite intervening edits or update only part of fleet | Preview fingerprint plus atomic SQL validation/locking. Real PostgreSQL simultaneous conflicting imports accept exactly one snapshot; cross-firm/stale imports rejected. |
| COMP-07 | P1 | Invalid attachment was rejected after document creation | Validate size/MIME/content first. HTTP proves malformed PDF does not create document. Storage failure explicitly says document details saved and requests only attachment retry. |
| COMP-08 | P2 | Duplicate task requests and stale assignment semantics | One active task per vehicle/type, unique constraint, owner-only close/cancel; driver only acknowledges current assignment. Different duplicate deadline rejected instead of silently ignored. |
| COMP-09 | P2 | Legacy document meters implied an arbitrary percentage; driver repeated the vehicle document list | Removed misleading expiry meters; current vehicle card and personal documents separated; retained owner history. |
| COMP-10 | P2 | Calendar link became ineffective when Fleet became default tab | Explicit calendar URL and compatibility for older view=cal links; Fleet hides irrelevant list/calendar switch. |
| COMP-11 | P2 | Trial banner partly hidden under desktop header; export button crowded toolbar | Corrected banner offset and spacing; inspected 1440px layout. |
| COMP-12 | P2 | Import read races and service errors could look like invalid CSV | Ignore obsolete file reads, handle read failure, separate 400 validation from 503 infrastructure error, preview before save. |

### Verification

- **27 suites passed with real local PostgreSQL 18.4:** main `smoke` chain plus card-periods, harsh, receipt-draft, native-tracking, gps-time, native-api, native-actions, driver-control and reliability:pg. No PostgreSQL skip in this run. The harsher suite includes 20,000 equal-time GPS points and tenant/date isolation. Native suites are code regressions, not physical-phone certification.
- **20 compliance groups passed** against memory and PostgreSQL, including simultaneous import/task requests, renewal gaps, archived/disabled targets, tenant isolation and terminal task states. Migration 0019 applied successfully; existing card-history migration regression verifies reapplication and retained legacy data.
- Production build and TypeScript passed. Full ESLint: 0 errors, 42 warnings (existing render/effect/image recommendations remain; this is not a warning-free codebase). `git diff --check` passed.
- **HTTP:** signup/invite/join using fictitious identities; document periods/attachment validation; report isolation; CSV preview/commit; owner/driver permissions; task acknowledgment; revocation after reassignment; private PDF access and RSC payload isolation.
- **Browser:** owner/driver documents at 320/390px and owner dashboard at 1440px; no document horizontal overflow in checked views. Filters show the expected single expired/missing demo vehicle. Real-flow local UI: CSV preview/save changes unknown to N1/vignette, future RCA shows not-yet-active, owner task creation and driver acknowledgment. Production build demo filters also checked without new hydration errors; the earlier development-only HMR hydration event remains noted, not suppressed.
- `@vercel/blob` updated 2.8.1 → 2.8.2. Removed deprecated Next preferredRegion exports; Frankfurt remains configured in vercel.json. Scoped esbuild override removes the vulnerable legacy development-server version; drizzle-kit schema generation verified in a temporary output directory.
- Production dependency audit: **0 known findings** in the registry snapshot. Full audit: **5 high findings in the lint toolchain**, all from unpatched braces <=3.0.3 via micromatch/fast-glob/Next ESLint. Do not apply npm's suggested downgrade to Next 14. Track upstream patch: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm. Latest major TypeScript/ESLint/Node type migrations are deliberately separate compatibility work.

### Still open

- COMP-OPEN-01: APNs/FCM/Web Push and receipt verification are not implemented. Current expiry alerts are in-app and provider-dependent email.
- COMP-OPEN-02: Resend delivery, failed/queued-email retry lifecycle, cron monitoring, production Blob and backup restore need operational acceptance. A mocked provider test is not external delivery proof.
- COMP-OPEN-03: TollRo quote/payment/reconciliation requires provider contract, API documentation and sandbox access. No invented prices, fines, grace periods or automatic valid/paid states.
- COMP-OPEN-04: Per-day document records cannot certify hour-specific validity, special exemptions or historical regulatory regimes. Provider/date-versioned rules are a separate implementation.
- Existing physical iPhone, two-device/offline and outbox refresh-boundary checks remain in the pilot backlog. See `COMPLIANCE.md` for scope and operator flows.


## 2026-10-18 — Push, email retry and activation preparation

Supersedes COMP-OPEN-01/02 **for implementation**, not live delivery acceptance. The user has no Resend verified sender or Apple Developer account yet. All provider sends in automated tests were mocked; HTTP/UI identities and the PostgreSQL database were local and fictitious. No customer messages were sent.

| ID | Priority | Defect / gap | Fix and evidence |
|---|---|---|---|
| NOT-01 | P1 | Failed emails had no durable retry lifecycle | Shared delivery outbox, bounded backoff, Retry-After, expiry, eight-attempt cap and visible terminal failures. Memory + real PostgreSQL. |
| NOT-02 | P1 | Parallel workers could resend or overwrite another worker's outcome | Atomic SKIP LOCKED claim, 90-second lease, fencing token, stable Resend idempotency key, 23-hour retry window. Twelve concurrent workers and stale-lease tests. |
| NOT-03 | P1 | A retry could alert a reassigned/disabled driver or reference a renewed document | Revalidate current account, email opt-in, assignment, document version, reminder threshold and task status immediately before dispatch. |
| NOT-04 | P1 | Old queued reset links/alerts could be replayed after enabling email | Migration cancels historical queued/failed rows lacking context. Fresh reset messages expire after 55 minutes and follow session version. |
| NOT-05 | P1 | Owner and driver had no usable push registration / revocation flow | Web Push and native iOS APNs, explicit opt-in, current-device test/off, all-device revoke, logout/account-switch revocation. Generic lock-screen text. HTTP + provider mocks. |
| NOT-06 | P1 | Cron Bearer secret was processed as a mobile token | Exclude authenticated cron routes from mobile-token dispatch; reject absent/wrong cron credentials. HTTP regression. |
| NOT-07 | P1 | PostgreSQL sub-millisecond default time could skip an immediately queued email | Set nextAttemptAt explicitly at insertion. Twenty immediate insert/send attempts on each store. |
| NOT-08 | P2 | Driver email missing; task acknowledgments did not notify owner | Driver can set their own email using PIN; scoped expiry/task email and push; owner receives acknowledgment. Tests verify cross-user isolation. |
| NOT-09 | P2 | Email templates linked to the wrong domain or owner-only page | Canonical APP_URL, shared authenticated notifications destination, absolute expiry date and calculation date. |
| NOT-10 | P2 | Job failure and provider acceptance could look like successful delivery | Persist job start/completion/failure; admin shows stale heartbeat, attempts, next retry and provider acceptance. No inbox/phone delivery claim. |
| NOT-11 | P2 | Preference controls usable before loading; checkbox inherited full-width input style | Disable until loaded, recover partial channel failure, correct checkbox layout, wrap controls, minimum 44px action targets. |
| NOT-12 | P1 | Native push could outlive mobile session or reactivate after remote opt-out | Registration expires with mobile session; scoped secure storage, server status reconciliation, permission revocation and rotation handling. |

### Verification and remaining acceptance

- **29/29 pilot suites passed** with real disposable PostgreSQL 18.4, including the complete smoke chain and native/tracking/integrity regressions.
- **38 notification groups passed** with memory and PostgreSQL: concurrency, retries, permanent errors, provider timeout, recipient changes, opt-out, task reconciliation, session expiry, renewal, tenant deletion, endpoint/curve validation and service-worker privacy.
- **HTTP suite passed:** owner/driver login and preferences, CSRF/body limits, password/PIN gate, endpoint validation, logout/account switch, all-device revocation, cron authentication, native status and web/native separation. No real push was sent. Native notification mock suite passed.
- TypeScript passed for web and native code. Owner settings saved successfully through the browser; checked page width at 390px equals scroll width (no horizontal overflow). Cold local development compilation exceeded the 15s preference-request timeout; the reload control recovered successfully. Driver API flows passed; live Safari/phone acceptance remains open. Full ESLint completed with 0 errors and 43 warnings (42 pre-existing recommendations plus a server-render clock purity warning in job monitoring). No lint errors are suppressed. The final web production build passed, including TypeScript, static generation and build tracing.
- iOS simulator compilation succeeded; attempted simulator installation stalled in CoreSimulator and was terminated. **No successful simulator launch or physical-iPhone push reception is claimed.** A simulator artifact is not an iPhone-installable signed build.
- Production web dependency audit: **0 known findings** in this registry snapshot. Full web audit: **5 high lint-toolchain findings** from unpatched braces. Native audit: **15 high dependency-chain findings** rooted in braces/node-forge in the Expo/React Native tooling; no compatible patched resolution was offered by npm. Forced Expo/React Native downgrades were not applied. Track upstream fixes; do not interpret the web production audit as a clean native audit.

Open operational gates: Resend sender/domain and credentials; VAPID keys on hosting; authenticated five-minute delivery scheduler; Apple Developer/APNs signing; real delivery and two-device/offline pilot. Web Push does not require an Apple Developer membership. Production configuration keeps the existing daily cron; fast retry must be explicitly scheduled on a compatible plan or external scheduler. See [NOTIFICATIONS.md](NOTIFICATIONS.md).

Still separate: email mailbox ownership verification and bounce/delivery webhooks; native Android FCM; daily generator pagination for very large fleets; TollRo provider integration; previous physical-device/GPS and outbox refresh-boundary acceptance checks.


## 2026-10-19 — QR, curse native, permisiuni și progres

| ID | Prioritate | Problemă | Corecție / dovadă |
|---|---|---|---|
| DRIVER-01 | P1 | Ecranul gol invita implicit șoferul să înceapă o cursă | Focus comun pentru curse eligibile pe camion; fără cursă: mesaj explicit și tură fără cursă numai la alegerea utilizatorului. Teste gol/viitor/terminat/anulat/alt camion. |
| DRIVER-02 | P1 | Lipseau confirmările native ale încărcării/descărcării și separarea etapelor | Acum/Urmează/Istoric; evenimente autentificate, idempotente, alocare verificată. HTTP: repetare, livrare fără POD, interdicție redeschidere și altă firmă. |
| DRIVER-03 | P1 | Solicitări repetate de permisiuni și stare GPS locală învechită | Citire înainte de request, respectare canAskAgain, revalidare tură după dialog; serviciul oprit nu rămâne afișat activ. Teste cu permisiuni acordate/refuzate și tură încheiată. |
| DRIVER-04 | P2 | Invitația era dificil de folosit fără SMS; QR expirat rămânea în ghid | QR local, utilizare unică, termen verificat, pagină de activare cu deschidere aplicație. Teste HTTP pentru invitație/PIN și QR; tamper/expiry în testele pure. |
| DRIVER-05 | P2 | Taxele și poziția nu erau accesibile nativ | Card Acte & taxe/Progres/Poziție; date necunoscute rămân necunoscute, poziția doar în tură publică. HTTP verifică lipsa poziției în Privat/după încheiere. |
| DRIVER-06 | P1 | Clasamentul real putea atribui istoricul camionului noului șofer | Activitate cu POD pe driverId, fereastră 30 zile, minimum 3 participanți, egalități corecte. Exclude anulate, viitoare, fără POD, alte firme. Vechiul teaser cu scor de consum apare doar în demo. |
| DRIVER-07 | P2 | Poziția dintr-un răspuns vechi putea păstra eticheta recentă offline | Vârsta se recalculează la 15 secunde; afișează ora și precizia. Comenzile locale Privat/Stop în așteptare ascund poziția și blochează confirmările de cursă. |
| DRIVER-09 | P1 | Reînnoirea în aceeași secundă putea reactiva vechiul link semnat | Timestampul invitației avansează atomic în PostgreSQL și memorie; testele verifică invalidarea tokenului vechi și accesul prin cel nou. |
| DRIVER-08 | P2 | Android sugera activare push fără control funcțional | Text explicit: alerte în aplicație, push Android încă neactiv. Firebase singur nu confirmă livrarea FCM. |

### Verificări

- **33/33 suite pilot trecute**, cu PostgreSQL de test izolat și server HTTP de producție local: tenant, invitații, stări curse, concurență, retry, outbox, GPS, notificări mock, API nativ și revocare. Nu au fost modificate datele firmei pentru teste.
- TypeScript web/native și build web trecute; regresiile noi verifică progresul,
  deep linkul fără credențiale și focusul corect al curselor.
- Browser: QR pe cont fictiv la **320 și 390 px**, scrollWidth = clientWidth,
  fără erori în consola paginii. Fără verificare fizică a scanării cu camera.
- Permisiunile de locație precisă/fundal ale Xiaomi M2003J15SC conectat sunt deja acordate. Testele simulate verifică nerepetarea cererii; acest lucru nu validează păstrarea serviciului GPS după restricțiile Xiaomi de baterie.

### Restanțe explicite

1. Recepție reală FCM Android: server, înregistrare/revocare token și livrare cu retry; configurația Firebase client este doar pregătirea.
2. Pilot pe traseu, două dispozitive, ecran blocat, economisire baterie Xiaomi, pierdere/revenire rețea și măsurarea bateriei. iPhone fizic și semnare/distribuție Apple rămân netestate în această rundă.
3. CMR/POD și gestionarea așteptării direct în aplicația nativă; momentan au flux web.
4. TollRo cumpărare/verificare/reconciliere: depinde de furnizor și acces API, inexistente momentan.
5. Recompense financiare: nu sunt implementate; regulile, sumele și aprobarea patronului trebuie definite separat. Distincțiile actuale sunt simbolice.
6. Activarea și acceptanța operațională a web push/emailurilor și schedulerului de retry rămân cele din NOTIFICATIONS.md. Senderul Resend a fost verificat și cheile de email au fost adăugate de utilizator; acest lucru nu echivalează cu livrare verificată în inbox.
