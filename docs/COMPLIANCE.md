# Documente și taxe rutiere — 18 octombrie 2026

## Audit înaintea modificării

| Domeniu | Exista | Lipsea / problemă |
|---|---|---|
| Documente | RCA, ITP, rovinietă, CASCO, documente șofer, fișiere și calendar | Lipsa unui document nu apărea în lista de expirări; nu exista începutul valabilității |
| Camioane | Număr, VIN, model, rezervor și costuri | Categoria de omologare, MTMA, locuri, EURO, propulsie, țara |
| Notificări | Cron zilnic, clopoțel, email Resend, deduplicare pe prag | Documentele înlocuite/arhivate și rovinietele nepotrivite regimului TollRo puteau produce alerte |
| Șofer | Curse, documente proprii, confirmări de livrare | Panou unificat de verificare, sarcini de la patron, acces la documentul vehiculului alocat |
| Taxe | Sumă introdusă pe cursă și deschidere portal TollRo | Nu există API, cotație, cumpărare ori confirmare oficială de plată |

## Implementat, în ordinea priorității

1. Model și reguli comune în `src/lib/compliance.ts`. Date necunoscute rămân necunoscute; nu deducem MTMA din încărcătură, tipul afișat sau numărul de înmatriculare. Propulsia electrică este separată de norma EURO. Migrarea aditivă `drizzle/0019_vehicle_compliance.sql` păstrează documentele și cursele existente.
2. `Documente → Flotă`: numere înaintea listelor, RCA/ITP, obligație rutieră, expirate/lipsă/date de verificat; filtre pe stare, regim și categorie. Acțiuni directe către adăugare, actualizare sau datele din talon. Starea „În termen · declarat” nu reprezintă o verificare în registre oficiale.
3. Ecran șofer: numai documentele vehiculului alocat sunt serializate către card; documentele personale sunt separate. Avertizare înainte de plecare pentru lipsă, expirare sau valabilitate viitoare. Fișierele sunt autorizate pe firmă și alocarea curentă, fără cache privat persistent.
4. Reînnoiri: documentul cu acoperire curentă are prioritate față de unul viitor. Un interval fără acoperire nu devine verde. Alertele, sumarul Acasă și notificările folosesc aceeași selecție; istoricul rămâne disponibil patronului.
5. Sarcini: patronul cere verificarea, șoferul confirmă preluarea, patronul închide după verificare. O singură sarcină activă per vehicul/tip, inclusiv la cereri simultane. Realocarea revocă accesul fostului șofer. Sarcina nu certifică documentul și nu confirmă plata.
6. CSV: șablon cu flota existentă, previzualizare, validare, detectarea modificărilor concurente și salvare atomică. Maximum 500 vehicule / 200 KB. Exportul situației este evidență declarată, **nu factură și nu raport de plăți reconciliate**.

## Flux recomandat

Patron: `Camioane → Date din talon` sau import CSV → `Documente → Flotă` → rezolvă întâi lipsurile și expiratele → adaugă începutul și sfârșitul valabilității și atașamentul → cere verificarea șoferului dacă este necesar → închide sarcina după verificare.

Șofer: verifică vehiculul afișat și documentele înainte de plecare → deschide fișierul sau portalul oficial → preia sarcina → transmite patronului dovada pentru actualizarea evidenței. Nu introduce automat datele firmei în servicii externe.

## Limite explicite și etapele următoare

- **TollRo:** numai deschidere portal oficial; fără furnizor/API nu putem confirma sesiuni, tichete, kilometri taxați, plăți ori facturi. Nu presupunem suport pentru precompletare sau deep link. Pașii tehnici de integrare sunt în `TOLLRO-INTEGRATION.md`.
- **Reguli și tarife:** clasificarea curentă pentru România separă transportul de persoane de marfă și pragul de 3,5 t. Nu este un motor istoric de reguli. Nu s-au implementat tarife, amenzi, perioade de grație sau data de tranziție pe baza promptului. Sunt necesare surse oficiale versionate și, pentru sume concrete, datele traseului/furnizorului.
- **Valabilitate:** model la nivel de zi, în Europe/Bucharest; nu certifică intervale orare ori valabilitatea unui tichet pe traseu. Excepții, înmatriculări speciale, remorci, alte țări și date contradictorii cer verificare individuală. Documentele opționale prezente sunt urmărite, dar nu deducem obligații profesionale din GPS.
- **Notificări:** cron zilnic la 03:00 UTC, autentificat obligatoriu cu `CRON_SECRET`. Praguri 30/14/7/1/0; in-app și email către patron dacă Resend este configurat. Lipsa configurației lasă emailul în coadă. Livrarea externă și retry-ul mesajelor eșuate trebuie validate/îmbunătățite separat; nu există încă push APNs/FCM/Web Push.
- **Pilot:** test pe iPhone fizic, notificări cu aplicația închisă, două dispozitive simultane, restaurarea backupului și Blob/Resend în producție rămân criterii operaționale, nu rezultate simulate prin browser.

Surse oficiale consultate la 18 octombrie 2026: [portal TollRo](https://portal.etoll.ro/web/guest/rotoll), [ghid rovinietă](https://portal.etoll.ro/web/guest/ghid-rovinieta). Portalul nu constituie un contract API. Nu prezentăm o estimare drept taxă achitată.

## Verificare reproductibilă

`npm run smoke:compliance`: reguli, reînnoiri, CSV și Store în memorie; cu `TEST_DATABASE_URL` rulează și PostgreSQL. `npm run smoke:compliance:http` cere `COMPLIANCE_TEST_URL` pe localhost și verifică faptul că baza este dezactivată înainte de a crea date fictive. Nu folosi bazele de producție pentru suitele care resetează schema.

Rezultatele, defectele remediate și restanțele sunt în `QA-AUDIT.md`.
