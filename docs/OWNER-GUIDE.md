# Ghid patron, întrebări de vânzare și priorități

Stare: 16 octombrie 2026. Răspunsurile descriu codul actual; nu sunt promisiuni despre
integrări, certificări sau servicii încă nelivrate. Registrul tehnic: [QA-AUDIT.md](QA-AUDIT.md).

## Cardul de carburant, pas cu pas

1. În **Camioane**, adaugă camionul și numărul corect de înmatriculare.
2. Apasă **Carduri carburant**. Introdu identificatorul exact al cardului din exportul
   furnizorului, păstrând zerourile inițiale. Spațiile și cratimele sunt ignorate, ca la CSV.
   Selectează camionul și **Valabil din**: data și ora locală folosite de exportul CSV.
   Salvează perioada; verifică intervalul afișat în istoric.
3. Descarcă CSV-ul din portalul DKV, OMV/Routex, MOL, Shell sau E100.
4. Încarcă CSV-ul în pagina Import, verifică datele, litrii, suma, moneda și camionul.
   Dacă formatul nu este recunoscut, mapează coloanele în previzualizare.
5. Alege camionul pentru rândurile necunoscute din fișier, apoi confirmă importul. Revizuiește rândurile respinse
   și alertele. Importurile repetate identice sunt deduplicate.

Alternativ, poți începe direct cu CSV: numerele de înmatriculare recunoscute se potrivesc
automat pe fiecare rând. Alegerile din previzualizare se aplică doar acelui fișier;
pentru viitoarele importuri, salvează explicit perioada cardului. Nu se cer PIN/CVV/parola furnizorului. Este un
identificator pentru import, nu un card bancar de abonament și nici o integrare API.

**Mutarea cardului:** apasă „Adaugă perioadă” lângă card, alege noul camion și data/ora
mutării. Exemplu: BH 01 AAA până la 16 octombrie 2026, 08:00; BH 02 BBB de la 08:00.
Alimentarea de la 07:59 rămâne la primul camion, cea de la 08:00 aparține celui de-al doilea.
Data este inclusivă; sfârșitul perioadei este următorul început, exclusiv.

O perioadă introdusă retroactiv poate reasocia alimentările deja importate din acel
interval, dar nu le schimbă pe cele anterioare sau dintr-o perioadă ulterioară. Dacă o
plăcuță recunoscută contrazice perioada, salvarea/importul se oprește cu explicație.
Aceeași dată/oră nu poate fi suprascrisă de alt camion. Corectarea sau ștergerea unei
perioade greșite la exact aceeași limită necesită momentan suport; nu introduce ore
false ca să ocolești verificarea. Datele din CSV fără fus orar sunt tratate ca ore locale
ale exportului, fără conversie automată în ora României.

## Întrebările pe care le va pune patronul

| Întrebare | Răspuns corect acum |
|---|---|
| Cu ce încep? | Camion → șofer + invitație → asociere șofer/camion → prima cursă → card/CSV → costuri. |
| Trebuie să instalez GPS? | Demo-ul este simulat. Pentru cont real există localizare prin telefon în tură; un conector pentru GPS-ul existent trebuie verificat separat. Nu promite compatibilitate universală. |
| Merge cu ecranul blocat? | Comportamentul browserului depinde de telefon și OS. Necesită probe reale; nu promite urmărire continuă în fundal. |
| Pot avea mai multe carduri pe un camion? | Da, identificatori diferiți pot fi asociați aceluiași camion. |
| Pot muta cardul pe alt camion? | Da: adaugi o perioadă cu data/ora mutării. Istoricul anterior rămâne la camionul vechi; contradicțiile cu plăcuțele sunt oprite. |
| Se sincronizează automat cu DKV/OMV? | În prezent, CSV. Introducerea identificatorului nu conectează portalul furnizorului. |
| Ce fac dacă import același fișier de două ori? | Tranzacțiile identice sunt deduplicate. Un export corectat trebuie revizuit: modificările datelor pot schimba cheia de deduplicare. |
| Detectează sigur furtul? | Nu. Afișează anomalii de verificat din datele disponibile. Verifici bonul, asocierea cardului, ora/fusul, coordonatele stației și contextul. O alertă sau confirmarea „verificată” nu dovedește furt ori vinovăția șoferului. |
| GPS-ul îmi dă consumul real? | Nu. GPS oferă poziție și distanță. Litri estimați = distanță × rată / 100. Cardul/bonul arată litri alimentați, nu automat consumați. Pentru reconciliere trebuie alimentări complete și niveluri comparabile sau CAN/FMS/senzori validați. |
| De unde vine referința de consum? | Istoricul alimentărilor anterior contului, dacă are intervale utilizabile de minimum 500 km; altfel norma declarată, apoi valoarea implicită 30 L/100km. Pagina camionului indică sursa. Alimentările parțiale pot distorsiona referința; nu există încă marcaj verificat plin-la-plin. |
| Ce înseamnă diferența estimată în lei? | Comparația dintre rata cursei și referință, la prețul introdus pe cursă. Nu dovedește că aplicația a produs economii. În cont real, totalul este al lunii curente, fără curse anulate; proiecția lunară extrapolează zilele scurse la un interval de 30 de zile. Anomaliile nu sunt convertite în bani recuperați. |
| Văd câți litri sunt în rezervor? | În cont real, nivelul este necunoscut fără sursă validată. Replay arată consum estimat. Nivelul din demo pornește dintr-o ipoteză explicată; integrarea sondelor/CAN/FMS este planificată, nu livrată. |
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

1. **Încredere înainte de extindere:** închidere OPEN-01/03/04/10, monitorizare, backup restaurat,
   pilot cu 2–3 firme, costuri estimate versus confirmate și verificarea cardurilor pe datele pilotului.
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


## GPS cu aplicația în fundal — direcție recomandată, 17 octombrie 2026

Produs recomandat: aplicație mobilă pentru șofer pe iOS/Android, cu interfață
comună și integrare nativă pentru locație; panoul patronului rămâne web pe
Windows/macOS/tabletă. Același repository și backend pot fi păstrate. Un PWA sau
un installer care doar deschide site-ul nu garantează GPS în fundal. Pluginul
standard Capacitor Geolocation nu oferă direct această funcție.

Implementarea nativă trebuie să includă:

1. Tura activată explicit, permisiuni explicate, Privat și Termină tura accesibile.
2. iOS: Core Location, background mode location, configurarea permisiunilor și
   indicatorul sistemului; Android: serviciu foreground de tip location pornit
   din aplicație, notificare persistentă și permisiunile cerute de versiunea OS.
3. Autentificare mobilă cu token revocabil și stocare securizată; nu se pune o
   cheie comună tuturor șoferilor în aplicație.
4. Coada locală protejată, ID unic pe punct, capturedAt separat de receivedAt,
   precizie, identificator de tură și deduplicare server. Nu se trimit puncte vechi
   la endpoint-ul web curent ca și cum ar fi poziții actuale.
5. Oprire locală imediată la Privat/terminare/deconectare și verificarea pe server
   a turei, alocării, revocării și intervalelor private la sincronizare.
6. TestFlight și test intern Google Play înainte de lansare; probe cu ecran stins,
   aplicație în fundal, baterie redusă, fără rețea, permisiuni retrase, restart,
   oprire forțată, schimbare camion și tură. Fără promisiunea că un telefon oprit
   sau o aplicație oprită forțat continuă să trimită.

Dacă poziția camionului trebuie să fie disponibilă independent de telefonul
șoferului, următoarea integrare este un dispozitiv GPS/telematică instalat pe
camion. GPS-ul singur produce distanțe/estimări și anomalii; nu dovedește consum
real sau furt de combustibil.

Documentație oficială:
- https://www.w3.org/TR/geolocation/#request-a-position
- https://developer.apple.com/documentation/corelocation/cllocationmanager/allowsbackgroundlocationupdates
- https://developer.android.com/develop/sensors-and-location/location/permissions
- https://capacitorjs.com/docs/apis/geolocation

## Un camion cu mai multe curse

Din Camioane sau profilul camionului, deschide **Curse și trasee**. Alege luna
plecării: vezi separat cursele în desfășurare, planificate și istoricul, cu ruta,
clientul și șoferul de atunci. **Detalii cursă** deschide documentele și datele
cursei; **GPS din cursă** arată numai punctele din intervalul încărcare–descărcare,
dacă există cel puțin două puncte distincte.

**GPS-ul camionului pe zi** este separat: poate include mai multe curse sau
deplasări fără cursă. Dacă o cursă veche nu are orele încărcării/descărcării,
este oferită această vizualizare, cu explicația limitei. Golurile din GPS nu
dovedesc o pauză privată, iar ultimul punct nu dovedește încheierea turei.
Orele sunt afișate în fusul României. Punctele noi păstrează ora UTC și precizia; datele vechi rămân la rezoluția lor originală.
În demo, butonul este numit **Simulare traseu**.

## Pilotul nativ pentru șofer

Proiectul iOS/Android există în același repository, cu Expo/React Native.
Instrucțiunile de instalare și probele obligatorii sunt în [NATIVE-DRIVER.md](NATIVE-DRIVER.md).
Nu este încă disponibil în magazine; activarea în producție rămâne oprită până
la testarea pe telefoane și rezolvarea restanțelor de lansare.

## Pilot Apple — săptămâna 19–25 octombrie 2026

Scop: probă controlată cu un patron, doi șoferi și două camioane. Nu folosi
rezultatele demo ca dovadă că datele unei firme reale se sincronizează.

### Înainte de plecare

- Folosește o firmă de test separată și conturi distincte patron/șofer. Marchează
  cursele de test și folosește documente fictive, fără datele clienților.
- Notează modelul iPhone, versiunea iOS și dacă deschizi Safari sau aplicația
  nativă. GPS în fundal se acceptă numai după testarea aplicației native semnate;
  pagina web nu oferă aceeași garanție.
- Confirmă că ambii șoferi pot accepta invitația, intra în cont și vedea camionul
  corect. Patronul verifică simultan de pe Mac.

### Proba, pas cu pas

1. Patronul creează o cursă pentru azi și una viitoare; șoferul vede clar cursa
   curentă, cea viitoare și istoricul. Celălalt șofer nu vede cursa colegului.
2. Șoferul pornește tura și confirmă încărcarea. Patronul vede aceeași stare,
   inclusiv după reîncărcarea paginii. Notează timpul efectiv al sincronizării.
3. Trimite un bon fictiv și un document POD. Verifică suma, camionul, cursa și
   documentul din ambele conturi. Repetarea aceleiași trimiteri nu creează dubluri.
4. Oprește conexiunea și încearcă o operațiune. Interfața trebuie să arate clar
   dacă a fost salvată sau așteaptă. Revino online și verifică înainte de retry.
5. Livrează cursa, verifică documentele și închide-o din rolul autorizat.
   Ea trebuie să treacă în istoric, iar cursa viitoare să rămână distinctă.
6. Compară manual venitul, fiecare cost și profitul. Separă alimentarea de
   consumul atribuit cursei și de orice estimare.
7. Pentru GPS nativ: testează 15 minute cu ecranul blocat, schimbare Wi-Fi/date,
   lipsă semnal, mod privat și sfârșit de tură. Verifică ora ultimei poziții pe
   Mac; modul privat și tura încheiată trebuie să oprească transmiterea.

Oprește pilotul dacă apar date din altă firmă/alt șofer, dubluri financiare,
confirmări false de salvare sau poziții trimise după activarea modului privat.
Pentru fiecare problemă notează: rol, oră, pagină/cursă de test, pași, rezultat
observat și rezultat așteptat; atașează captură fără parole sau coduri de acces.

### Verificarea tehnică înaintea probei

- `npm run check:pilot`: verificări locale; raportul spune explicit că este parțial.
- După `npm run build`, setează `TEST_DATABASE_URL` către o bază **de test,
  dispensabilă**, apoi rulează `npm run check:pilot -- --postgres --http`.
  Scriptul aplică migrațiile exclusiv pe această bază și nu folosește DATABASE_URL
  al aplicației. Nu indica baza firmei: testele injectează inclusiv erori SQL.
- Un rezultat verde nu închide testele manuale de Safari/iPhone și nici
  acceptarea pe două dispozitive. Consultă ultima rundă din QA-AUDIT.md.
