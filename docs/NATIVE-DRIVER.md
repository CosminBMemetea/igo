# Querra Șofer — pilot iOS / Android

Aplicația nativă se află în `apps/driver`, în același repository. Patronul folosește
aplicația web. Nu este nevoie de alt repository. Pilotul nu este încă certificat
pentru utilizare operațională și nu are APK/IPA semnat.

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

## Probe de acceptare — mai întâi Android, apoi iOS

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
   mesajul de reîncercare pe server dacă altă operație era deja în curs.
6. Mod avion, semnal GPS slab, conexiune schimbată Wi-Fi/date, economisire baterie,
   revocare permisiune, restart telefon și închidere forțată a aplicației.
   Nu există garanție de relansare după force-quit; UI trebuie să indice lipsa ACK.
7. Două telefoane: nu presupune că oprirea locală a unuia oprește celălalt.
   Privat/tură încheiată trebuie să blocheze pe server ambele surse.
8. Layout: telefon mic, text mărit, tastatură deschisă, nume/rute lungi, iPad,
   TalkBack/VoiceOver. Nu s-au făcut încă aceste probe pe dispozitiv.
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
