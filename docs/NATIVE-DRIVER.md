# Querra Șofer — pilot iOS / Android

Aplicația nativă se află în `apps/driver`, în același repository. Patronul folosește
aplicația web. Nu este nevoie de alt repository. Pilotul nu este încă certificat
pentru utilizare operațională. Există APK Android semnat pentru test local;
arhiva iPhone este încă nesemnată.

## Ce există

- Login cu contul real al șoferului (telefon și PIN/parolă). Conturile demo și
  proprietarii nu primesc token nativ. Nu se includ secrete în aplicație.
- Camion atribuit; tură și checklist; Privat; oprire GPS; curse în curs, de început,
  viitoare, livrate fără POD, încheiate și anulate. Nu se trimit costuri/venituri.
- GPS nativ în fundal prin Expo Location + TaskManager, autorizat explicit.
  Android: serviciu foreground vizibil. iOS: indicator și permisiune Always.
- Token în SecureStore, disponibil după prima deblocare a telefonului. Valabil
  12 ore. Schimbarea PIN-ului/dezactivarea contului invalidează sesiunea pe server.
- Privat și încheiere tură opresc întâi colectarea locală; la lipsa rețelei,
  comanda pentru server se păstrează și se reîncearcă, inclusiv după reautentificare. GPS nu repornește înainte
  de confirmarea acesteia și de un acord nou. Coada este separată după backend,
  firmă și șofer, iar comanda identifică exact tura; nu se aplică unei ture noi.
  Încheierea de tură are prioritate față de o comandă Privat ulterioară offline.
- Punctele au capturedAt UTC și receivedAt UTC. Sunt respinse punctele mai vechi
  de 30 secunde, din viitor >5 secunde sau cu precizie >65 metri.

## Instalare pentru dezvoltare

1. Instalează Node compatibil cu Expo SDK 58 și instrumentele native cerute de
   documentația Expo. Pe acest Mac există Node 24 în runtime-ul Codex.
2. Din rădăcina web: `npm ci`, configurează baza de test, rulează migrațiile și
   build-ul. Folosește un domeniu HTTPS de staging cu certificat valid.
3. Activează `MOBILE_DRIVER_ENABLED=1` numai în staging pentru testele de mai jos.
   Implicit este oprit: tokenurile mobile nu sunt acceptate.
4. În `apps/driver`: `npm ci`. Copiază `.env.example` în `.env` și setează
   `EXPO_PUBLIC_API_URL=https://domeniul-de-staging` (fără path/query/token).
5. `npm run typecheck`; `npm run export`; `npx expo prebuild --no-install`.
   Proiectele native sunt generate din app.config.ts și sunt ignorate de Git.
6. Android: instalează Android Studio, SDK și JDK compatibile cu Expo SDK 58;
   acceptă personal licențele SDK. Activează USB debugging pe telefon și aprobă
   cheia Mac-ului pe ecranul telefonului. Verifică `adb devices -l`, apoi
   `npm run android`. ADB furnizat: `/Users/come/Downloads/platform-tools/adb`.
7. iOS: instalează Xcode complet din App Store, deschide-l și finalizează configurarea.
   Configurează semnarea cu echipa Apple, conectează/deblochează iPhone-ul și
   activează Developer Mode dacă iOS îl cere. Rulează `npm run ios -- --device`.
8. Expo Go NU este testul pentru GPS în fundal. Folosește development build sau
   build semnat. `eas.json` pregătește profiluri development/preview/production;
   EAS și publicarea necesită conturi și configurare suplimentară.

Bundle ID pilot: `com.querra.qfleet.driver`. Confirmă identitatea legală și
identificatorul înainte de prima înscriere în magazine (ulterior nu se schimbă
liber). Nu s-au creat conturi și nu s-au acceptat contracte în numele firmei.

## Build iPhone fără telefon conectat

Prioritatea curentă este iPhone. Pentru compilare locală sunt necesare Xcode
complet, Node și CocoaPods (verificat cu Xcode 27.1, Ruby 4.0.7, CocoaPods 1.17.0).
Ruby/CocoaPods pot fi instalate separat de Ruby-ul macOS; nu schimba Ruby-ul sistemului.

Pe Mac-ul pregătit în această rundă, terminalul poate folosi instrumentele locale:

```sh
export PATH="$HOME/.cache/querra-ios-tools/portable-ruby/4.0.7_1/bin:$HOME/.cache/querra-ios-tools/gems/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
export GEM_HOME="$HOME/.cache/querra-ios-tools/gems"
export GEM_PATH="$GEM_HOME"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
```

În `apps/driver`, setează `EXPO_PUBLIC_API_URL` în `.env.local`, apoi:

```sh
npm ci
npm run typecheck
npm run ios:check
npm run ios:build:device
```

Scriptul validează originul HTTPS, generează proiectul iOS, instalează pods și
compilează Release. Arhiva rezultată este
`apps/driver/build/ios/device/QuerraSofer.xcarchive`; `build-info.json` păstrează
backendul, commitul, starea modificărilor locale și ora buildului. **Arhiva este
nesemnată: nu se instalează direct pe iPhone.** La distribuție trebuie selectate
echipa Apple și provisioningul, apoi creat un build semnat prin Xcode/EAS.
Nu există un IPA distribuibil doar prin redenumirea acestei arhive.

`npm run ios:build:simulator` produce separat un `.app` pentru simulator.
Rularea acestuia cere și runtime-ul iOS instalat în Xcode. Nici compilarea, nici
simulatorul nu validează GPS în fundal, consumul bateriei sau comportamentul
după blocarea ecranului pe un telefon real.

Buildul local din această rundă folosește originul verificat
`https://igo-kappa.vercel.app`. Backendul mobil rămâne dezactivat implicit;
loginul explică explicit această situație. Pentru acceptare folosește staging
cu `MOBILE_DRIVER_ENABLED=1` și date fictive înainte de activarea producției.

Validare locală la 17 octombrie 2026: arhivare Release **reușită**, versiunea
0.1.0 (1), arm64, minimum iOS 16.4. Arhiva include bundle-ul Hermes, backendul
HTTPS și pictograma Querra de 1024 px, fără declarațiile Face ID/Motion.
Sursa aplicației: `d42964d`, arbore curat la build. A fost creat și ZIP-ul
`build/ios/device/QuerraSofer-iPhone-0.1.0-unsigned.zip`. Nu conține semnătură sau
profil de instalare. Runtime-ul simulatorului nu a fost instalat; nu s-au făcut
probe vizuale native sau de GPS fizic. Avertismentele compilatorului și celelalte
restanțe sunt consemnate în runda 21 din `QA-AUDIT.md`.

Când telefonul este disponibil: deschide proiectul generat
`ios/QuerraSofer.xcworkspace` în Xcode, selectează echipa Apple la Signing &
Capabilities și telefonul ca destinație. Autentificarea în contul Apple și
aprobările de pe telefon se fac de către utilizator. Urmează probele de mai jos
pe backendul de staging înainte de activarea accesului mobil în producție.

## Probe de acceptare — mai întâi iPhone

Pentru fiecare probă: înregistrează modelul/OS, versiunea build-ului, ora UTC,
permisiunile și rezultatul observat pe telefon + pe harta patronului. Folosește
un cont și traseu de test, nu datele unui angajat fără informare.

1. Login greșit/corect, limitarea încercărilor, cont dezactivat, PIN schimbat,
   token expirat, lipsa camionului și schimbarea atribuirii în timpul colectării.
2. Checklist incomplet, început tură, activare GPS explicită, permisiune refuzată,
   locație aproximativă, Always/background refuzat și revenire din Settings.
3. 30 minute cu ecran blocat și deplasare reală. Compară capturedAt/receivedAt
   și confirmarea patronului. Măsoară golurile și consumul bateriei; nu inventa SLA.
4. Privat: nicio poziție nouă după confirmarea opririi; repetă fără internet,
   închide/redeschide aplicația, reconectează și verifică reîncercarea comenzii.
   Repetă după schimbarea contului și revenirea în contul inițial; după începerea
   unei ture noi pe alt telefon; cu o confirmare întârziată și o comandă nouă.
   Comanda veche nu trebuie să afecteze alt cont sau altă tură.
5. Încheiere tură și Oprește GPS: verifică dispariția colectării și a indicatorului
   sistemului. Reluarea necesită acțiune explicită.
   Repetă în timpul unei cereri blocate și al dialogului de permisiuni. Verifică
   salvarea imediată a comenzii și sincronizarea automată după ce operația
   anterioară se termină. UI trebuie să arate explicit confirmarea în așteptare.
6. Mod avion, semnal GPS slab, conexiune schimbată Wi-Fi/date, economisire baterie,
   revocare permisiune, restart telefon și închidere forțată a aplicației.
   Nu există garanție de relansare după force-quit; UI trebuie să indice lipsa ACK.
7. Două telefoane: nu presupune că oprirea locală a unuia oprește celălalt.
   Privat/tură încheiată trebuie să blocheze pe server ambele surse.
8. Layout: telefon mic, text mărit, tastatură deschisă, nume/rute lungi, iPad,
   VoiceOver (iOS), apoi TalkBack (Android). Nu s-au făcut încă aceste probe pe dispozitiv.
9. Recunoașterea corectă a orei repetate la DST, ordinea punctelor, separarea
   curselor aceleiași zile și date din altă firmă respinse.
10. Verifică documentele de confidențialitate, informarea șoferului, retenția și
    declarațiile App Privacy/Data Safety înainte de distribuire.

## Limite reale ale pilotului

Fără outbox GPS offline: punctele netrimise se pierd și sunt afișate ca lipsă de
confirmare. Fără upload nativ CMR/POD și evenimente de cursă: acestea rămân în web.
Fără revocare individuală per telefon sau reînnoire automată de token.
Logout oprește GPS pe telefon, dar tura se încheie prin butonul dedicat.
GPS nu măsoară consumul real și nu demonstrează furtul de combustibil.

Auditul de dependențe Expo și probele de dispozitiv au restanțe explicite în
`QA-AUDIT.md`. Nu activa pilotul în producție înainte de rezolvarea blocajelor.

Surse tehnice: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/),
[TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/),
[SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Android — APK de test semnat (17 octombrie 2026)

Pe acest Mac sunt instalate JDK Temurin 17, Android SDK/CLI, platforma 37,
Build Tools 37.0.0, NDK 27.1.12297006 și emulatorul Android 36.1 `small_phone`.
Android Studio nu este necesar pentru scriptul de build local.

Din `apps/driver`, cu Node în PATH:

```sh
npm run android:check
npm run android:build:preview
```

Scriptul folosește `JAVA_HOME` și `ANDROID_HOME` dacă sunt definite; altfel
caută JDK-ul instalat în `~/.cache/querra-android-tools/jdk` și SDK-ul în
`~/Library/Android/sdk`. `EXPO_PUBLIC_API_URL` trebuie să fie origin HTTPS valid.
Pentru staging schimbă originul și reconstruiește: acesta este inclus în APK.

Rezultat: `build/android/preview/QuerraSofer-Android-0.1.0-preview.apk`, cu
`build-info.json` și `verification.txt`. Aplicația se numește **Querra Șofer Test**,
identificator `com.querra.qfleet.driver.preview`, versiunea 0.1.0 (1).
Build Release, fără Metro, minimum Android 7/API 24; include numai arhitecturile
64-bit `arm64-v8a` și `x86_64`. Minimum SDK declarat nu înseamnă că fiecare
versiune Android a fost testată; telefoanele exclusiv 32-bit nu sunt acoperite.

Instalare USB, după conectarea și autorizarea telefonului:

```sh
~/Library/Android/sdk/platform-tools/adb devices -l
# Înlocuiește SERIAL cu telefonul verificat în lista de mai sus.
~/Library/Android/sdk/platform-tools/adb -s SERIAL install -r build/android/preview/QuerraSofer-Android-0.1.0-preview.apk
```

Alternativ, copiază APK-ul pe telefon, deschide-l și permite instalarea pentru
aplicația folosită la deschidere, dacă Android o solicită. Nu este o publicare
Google Play. Identitatea de test este separată de viitoarea aplicație de producție.

Cheia privată de test este în `~/.local/share/querra/android-preview-signing`;
directorul are permisiuni 0700, fișierele 0600. Păstrează o copie securizată a
**întregului director**, separat de Git. Actualizările aceleiași aplicații cer
aceeași cheie. Nu distribui `preview.p12` sau fișierul `password` cu APK-ul.
Scriptul verifică semnătura și amprenta certificatului, permisiunile, bundle-ul
JS și alinierea ZIP la 16 KB înainte să livreze artefactul.

Pe Android 13+ aplicația cere explicit permisiunea pentru notificări înainte
să pornească GPS. Refuzul oprește activarea și explică revenirea în Setări.
Sunt necesare și locația precisă și accesul în fundal („Tot timpul”). Nu se cer
microfon, acces general la stocare sau suprapunerea peste alte aplicații.

**Backend pilot activat (19 octombrie 2026):** originul inclus în APK rămâne
`https://igo-kappa.vercel.app`, pentru păstrarea sesiunii instalate. Atât acesta,
cât și domeniul firmei `https://fleet.querra.net` au pilotul mobil activ;
cererea fără credențiale returnează eroarea de validare 400, nu dezactivarea 403.
Utilizatorul a confirmat autentificarea și sincronizarea unei curse pe Xiaomi.
Conturile demo web nu sunt conturi native. Validarea GPS pe traseu, cu ecranul
blocat și economisirea bateriei, rămâne necesară.

Pentru distribuție Play mai sunt necesare contul firmei, identitatea definitivă,
semnarea/AAB de producție, materialele și declarațiile cerute de magazin și
verificarea politicilor curente. Cheia locală de preview nu este o configurare
Play App Signing. Nu s-a publicat în magazin.


## 19 octombrie 2026 — Invitații QR și ecranul șoferului

- Patron: **Șoferi → Adaugă șofer → Arată QR pentru activare**. QR-ul este
  generat local de server, fără servicii terțe. Este valabil 14 zile, o singură
  dată; revocarea și reînnoirea se verifică pe server. După creare/reînnoire,
  pagina deschide invitația respectivă. Invitațiile expirate nu mai afișează QR.
- Șofer: scanează cu camera telefonului, deschide pagina și alege PIN-ul de
  6 cifre. Nu este necesar SMS; funcționează prin Wi-Fi. Numărul introdus în
  invitație rămâne identificatorul de autentificare. Pagina de succes oferă
  deschiderea aplicației instalate (inclusiv varianta Android Test) și browser.
  Linkul nativ precompletează doar telefonul, niciodată PIN-ul sau sesiunea.
- **Acum / Urmează / Istoric** separă cursele disponibile de cele viitoare,
  livrate fără POD, încheiate și anulate. Încărcarea/descărcarea se confirmă
  nativ, cu verificarea alocării și cheie de idempotency. CMR/POD și oprirea
  așteptării se fac încă din interfața web. Fără cursă eligibilă nu apare
  îndemnul implicit de a începe; există separat „Lucrez fără cursă alocată”.
- **Acte & taxe / Progres / Poziție**: profilul vehiculului, starea documentelor,
  portalul oficial de taxe, livrările cu POD, distincții simbolice și ultima
  poziție confirmată, cu oră/precizie și link explicit către hartă externă.
  Poziția veche nu este prezentată ca live; Privat/încheierea turei o ascund.
- Clasamentul real folosește livrările documentate atribuite șoferului pe cursă,
  nu istoricul camionului său actual. Fereastra este de 30 de zile în fusul
  Europe/Bucharest. Sunt necesari minimum 3 șoferi cu livrări în perioadă;
  egalitățile păstrează același loc. Nu este un scor de siguranță, de consum
  sau un drept la prime. Distincțiile de 1/5/10/25 livrări nu au valoare în bani.
- Permisiunile deja acordate sunt verificate înainte de solicitare. Refuzul
  definitiv trimite spre Setări; nu repetăm dialogurile automat. Informarea
  proprie despre GPS se păstrează după activarea reușită, separat pe sesiune.
  Pornirea GPS rămâne explicită; nu se repornește automat după oprire/Privat.
- Android: Firebase este configurat pentru identitatea APK-ului de test, dar
  livrarea push FCM nu este încă implementată. Alertele din aplicație se
  actualizează la revenire și la 15 secunde cât aplicația este în prim-plan.
- TollRo: afișare documente/profil și acces la portal, fără cumpărare automată,
  tarife inventate sau confirmare a plății. Integrarea tranzacțională necesită
  contract, documentație și acces tehnic de la furnizor.

Verificare dispozitiv: APK-ul final din commitul `5f42b20` (surse curate), construit
la 19 octombrie 2026, 18:20 UTC, a fost instalat cu succes peste versiunea existentă
pe Xiaomi M2003J15SC / Android 12. Sesiunea și permisiunile acordate au fost
păstrate; ecranele Curse, Acte & taxe, Progres și Poziție au fost inspectate.
Această verificare nu certifică traseul GPS cu ecranul blocat sau notificări FCM.

## 19 octombrie 2026 — lucru nativ și sincronizare persistentă

- Navigație fixă **Azi / Curse / Acte / Cont**. Azi arată numai cursa curentă sau
  următoarea cursă eligibilă pe camionul alocat. Curse păstrează Acum/Urmează/Istoric.
- CMR/POD: cameră sau selectorul sistemului → JPEG cu latura maximă 2200 px și
  maximum 2 MB → previzualizare → trimitere explicită. Fiecare pagină se adaugă
  separat. Permisiunea pentru cameră se cere numai la utilizare; microfonul și
  accesul larg la stocarea Android rămân blocate. Nu se solicită acces la întreaga
  galerie pentru selectorul sistemului.
- Fotografiile de verificat și operațiile netrimise sunt păstrate în directorul
  privat al aplicației, separat de cache. Jurnalul păstrează două generații pentru
  recuperare după o scriere întreruptă. Datele sunt delimitate prin backend,
  firmă și utilizator. Dezinstalarea/ștergerea datelor aplicației pierde fișierele
  locale; deconectarea le păstrează pentru același cont.
- Încărcare, descărcare și început/sfârșit așteptare folosesc ID-uri persistente și
  ora acțiunii. Progresul local este marcat explicit; nu acordă POD sau distincții
  până la confirmarea serverului. Un conflict blochează operațiile dependente ale
  aceleiași curse, fără a bloca alte curse. Retry păstrează ID-ul și ora originale.
- Retry se execută în prim-plan și la revenirea în aplicație, cu temporizare până
  la 5 minute pentru erori temporare. **Nu este un serviciu OS de upload în fundal**.
  O sesiune expirată cere reautentificare, fără pierderea cozii locale. Cache-ul
  mai vechi de 24 de ore nu permite înregistrarea de etape noi.
- API mobil: POST `/api/files` folosește autentificarea existentă, validarea
  conținutului, limita de 2 MB, deduplicarea și actualizarea atomică POD. Noul
  jurnal mobil din `/api/driver/mobile` expune numai metadatele documentelor
  curselor șoferului, fără URL-uri Blob sau date financiare.
- Migrarea `0021_mobile_paperwork_guard.sql` reverifică alocarea la salvarea
  documentului, sub blocarea rândului cursei. Comenzile de etapă native includ
  camionul și identitatea turei; nu se aplică automat unei ture ulterioare.

Restanța CMR/POD/așteptare exclusiv în web din secțiunea anterioară este înlocuită
prin acest flux. FCM, integrarea tranzacțională TollRo și pilotul GPS pe traseu
rămân separate. Implementarea este comună Android/iOS; validarea pe iPhone fizic
rămâne necesară.

APK-ul acestei runde (`1b9406f`, Release semnat, 19 octombrie 2026, 19:11 UTC)
este instalat pe Xiaomi. Verificate fizic: cele patru taburi, lipsa acțiunii de
încărcare în afara turei, listele goale viitoare/istoric, selectarea unei imagini
fictive, previzualizarea și restaurarea draftului după închidere forțată. Draftul
a fost eliminat local fără trimitere. Pentru iOS a trecut exportul Metro/Hermes;
acesta nu este un IPA semnat și nu înlocuiește proba pe iPhone.
