# Ghid patron, întrebări de vânzare și priorități

Stare: 15 octombrie 2026. Răspunsurile descriu codul actual; nu sunt promisiuni despre
integrări, certificări sau servicii încă nelivrate. Registrul tehnic: [QA-AUDIT.md](QA-AUDIT.md).

## Cardul de carburant, pas cu pas

1. În **Camioane**, adaugă camionul și numărul corect de înmatriculare.
2. Apasă **Carduri carburant**. Introdu identificatorul exact al cardului din exportul
   furnizorului, păstrând zerourile inițiale; selectează camionul; salvează asocierea.
3. Descarcă CSV-ul din portalul DKV, OMV/Routex, MOL, Shell sau E100.
4. Încarcă CSV-ul în pagina Import, verifică datele, litrii, suma, moneda și camionul.
   Dacă formatul nu este recunoscut, mapează coloanele în previzualizare.
5. Asociază cardurile necunoscute, apoi confirmă importul. Revizuiește rândurile respinse
   și alertele. Importurile repetate identice sunt deduplicate.

Alternativ, poți începe direct cu CSV: numerele de înmatriculare recunoscute se potrivesc
automat și se învață asocierea cardului. Nu se cer PIN/CVV/parola furnizorului. Este un
identificator pentru import, nu un card bancar de abonament și nici o integrare API.

**Limită:** asocierea unui card se aplică și tranzacțiilor deja importate. Nu folosi
reasocierea pentru un card care a fost folosit pe camioane diferite în perioade diferite;
istoricul cu dată efectivă este prioritate OPEN-02.

## Întrebările pe care le va pune patronul

| Întrebare | Răspuns corect acum |
|---|---|
| Cu ce încep? | Camion → șofer + invitație → asociere șofer/camion → prima cursă → card/CSV → costuri. |
| Trebuie să instalez GPS? | Demo-ul este simulat. Pentru cont real există localizare prin telefon în tură; un conector pentru GPS-ul existent trebuie verificat separat. Nu promite compatibilitate universală. |
| Merge cu ecranul blocat? | Comportamentul browserului depinde de telefon și OS. Necesită probe reale; nu promite urmărire continuă în fundal. |
| Pot avea mai multe carduri pe un camion? | Da, identificatori diferiți pot fi asociați aceluiași camion. |
| Pot muta cardul pe alt camion? | Asocierea actuală este globală și afectează istoricul. Asocierea pe perioade trebuie livrată înainte de a susține acest flux. |
| Se sincronizează automat cu DKV/OMV? | În prezent, CSV. Introducerea identificatorului nu conectează portalul furnizorului. |
| Ce fac dacă import același fișier de două ori? | Tranzacțiile identice sunt deduplicate. Un export corectat trebuie revizuit: modificările datelor pot schimba cheia de deduplicare. |
| Detectează sigur furtul? | Afișează suspiciuni pe reguli și date disponibile. Verifici bonul, GPS-ul, rezervorul și contextul; nu este o probă automată de furt. |
| Profitul este exact? | Depinde de completitudinea veniturilor/costurilor. Explică datele estimate și confirmate; nu-l prezenta drept contabilitate fiscală. |
| Pot lucra în EUR și alte valute? | Bonurile păstrează valuta și conversia disponibilă. Raportarea financiară completă în mai multe valute rămâne de consolidat. |
| Ce se întâmplă fără internet? | Bonurile și evenimentele pot sta în coada telefonului și se retrimit cât pagina este deschisă. Turele/GPS/CMR/POD și prima încărcare a paginii necesită internet. |
| Văd șoferul în afara programului? | Poziția se colectează în tură și se oprește în privat/în afara turei. Demonstrează efectiv schimbarea de rol. |
| Șoferul vede banii firmei? | Rolul șoferului este limitat la pagina și operațiunile lui; testele verifică separarea tenantului și asignarea. |
| Cum scot un șofer care pleacă? | Dezactivează contul; accesul este verificat pe server. Istoricul nu dispare. |
| CMR/POD țin loc de document original? | Sunt copii încărcate pentru fluxul operațional; nu promite statut juridic/certificare e-CMR. |
| Trimite facturi și e-Factura? | Există vizualizări și date de facturare, dar ciclul fiscal complet, integrarea e-Factura și încasările automate nu sunt livrate ca produs complet. |
| Cum îmi mut datele din Excel? | CSV de carburant are previzualizare/mapare. Migrarea întregii firme necesită analiză și import dedicat. |
| Unde sunt datele și cum le recuperez? | Configurația indică găzduire UE; retenția, backupul și restaurarea trebuie confirmate operațional. Export/ștergere se solicită prin suport. Nu promite SLA neverificat. |
| Cine plătește AI/OCR sau GPS? | Definește limitele comerciale după măsurarea costurilor. Nu promite AI nelimitat sau hardware inclus. |
| Pot testa fără date reale? | Da: demo patron și șofer, cu 7 camioane. Tura/privat/bonurile se păstrează în sesiunea browserului; confirmările și pozele demo ale cursei sunt temporare. |

## Ordinea recomandată a funcțiilor viitoare

1. **Încredere înainte de extindere:** închidere OPEN-01…04, monitorizare, backup restaurat,
   pilot cu 2–3 firme, costuri estimate versus confirmate și asociere card pe perioade.
2. **Planificare simplă:** disponibilitate camion/șofer pe calendar, avertizare suprapuneri,
   indisponibilități/revizii și duplicare rapidă de curse. Acceptare: nicio dublă alocare
   neavertizată, inclusiv două persoane care lucrează simultan.
3. **Bani de încasat:** cursă → CMR/POD → factură → scadență → încasare; export contabil,
   monedă/TVA explicite și jurnal al modificărilor. Facturarea fiscală cere integrare și
   validare dedicate, nu doar un PDF cu aspect de factură.
4. **Mai puțin import manual:** conector pentru furnizorul de card/GPS folosit de primii
   clienți, cu acordul lor, contract API, sincronizare idempotentă și monitorizare.
5. **Șofer pe mobil:** încărcări CMR/POD în coadă, recuperare după tab închis, apoi aplicație
   mobilă dacă GPS-ul de fundal este cerință obligatorie. OCR cu verificare umană.
6. **După validarea cererii:** dispeceri cu permisiuni, remorci, mentenanță, rutare pentru
   camioane, integrare tahograf și e-CMR. Nu eticheta demo-ul OSRM ca rutare certificată.

Prioritățile nu sunt un calendar promis. Pentru fiecare funcție: problemă măsurabilă,
criteriu de acceptare, test de regresie și rezultat în pilot înainte de publicitate.
