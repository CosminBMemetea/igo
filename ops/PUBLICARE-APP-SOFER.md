# Publicarea aplicației Querra Șofer (iOS + Android)

Aplicația este în `apps/driver` (Expo SDK 58). Codul este pregătit pentru build; pașii de mai jos cer conturile și semnăturile tale. **Nu lipi niciodată chei, parole sau fișiere .p8/.jks în chat sau în git** — doar ca secrete EAS / variabile de mediu.

Identificatori: iOS `com.querra.qfleet.driver` · Android `com.querra.qfleet.driver` (preview: `.preview`). Nume: Querra Șofer / Querra Driver / Querra Kierowca.

## 1. Conturi (o singură dată)
1. **D-U-N-S pentru QUERRA S.R.L.** — cerere gratuită la https://developer.apple.com/enroll/duns-lookup/ (durează 1–14 zile). Numele și adresa trebuie să fie identice cu cele de la Registrul Comerțului.
2. **Apple Developer Program ca organizație** — https://developer.apple.com/programs/enroll/ , 99 USD/an. Ai nevoie de D-U-N-S, site-ul firmei pe domeniul tău, un Apple ID cu 2FA, și să fii reprezentant legal (sau să ai împuternicire).
3. **Google Play Console ca organizație** — https://play.google.com/console/signup , 25 USD o dată. Cere D-U-N-S la conturile de organizație, verificarea identității și un telefon/email de contact public.
4. **Expo (EAS)** — cont gratuit pe https://expo.dev, organizația `querra`.

## 2. Secrete (doar pe calculatorul tău sau în EAS)
- `eas login` apoi `cd apps/driver && eas init` (scrie `projectId` în config — se poate comite).
- **iOS:** în App Store Connect → Users and Access → Integrations → *App Store Connect API* creează o cheie cu rol *App Manager*. Descarcă `.p8` o singură dată. Rulează `eas credentials -p ios` și încarcă cheia acolo (Key ID + Issuer ID). EAS generează certificatul de distribuție, profilul și cheia APNs.
- **Android:** `eas credentials -p android` → lasă EAS să genereze keystore-ul (fă backup). Pentru `eas submit` creează un *service account* Google Cloud cu acces la Play Console și încarcă JSON-ul ca secret EAS (`eas credentials` → Google Service Account), nu în repo.
- **Push:** `apps/driver/firebase/google-services.production.json` (Firebase, pachetul `com.querra.qfleet.driver`) — nu se comite dacă repo-ul e public; pune-l ca *file secret* EAS. Pe server rămân variabilele FCM/APNs existente din Vercel.
- `.p8`, `.jks`, `service-account.json` nu intră niciodată în git.

## 3. Build și trimitere
```
cd apps/driver
npm ci
eas build -p ios --profile production
eas build -p android --profile production   # .aab
eas submit -p ios --latest                   # TestFlight
eas submit -p android --latest               # Internal testing (draft)
```
Testează pe TestFlight și pe Internal testing cu un șofer real înainte de producție.

## 4. Fișa din magazine
Texte gata în `apps/driver/store/`:
- `listing.ro.md`, `listing.en.md`, `listing.pl.md` — nume, subtitlu, descriere, cuvinte cheie. Completează emailul de suport.
- `play-data-safety.md` — răspunsuri Data safety + declarația locație în fundal.
- `app-review-notes.md` — note pentru Apple Review.
- Capturi: 6.7" iPhone (1290×2796) și telefon Android (min. 1080×1920), RO/EN/PL. Capturile din `screenshots/fleet/r20` sunt doar orientative; capturile finale se fac pe buildul real (TestFlight / emulator).
- Politica de confidențialitate: https://fleet.querra.net/privacy

## 5. Locația în fundal — ce cer Apple și Google
**Apple (App Review):** aplicația folosește `UIBackgroundModes: location`. Justificarea (în `app-review-notes.md`): colectarea pornește doar când șoferul apasă *Activează GPS* într-o tură deschisă, poziția merge doar la firma lui (harta flotei, confirmarea curselor, avertizarea la depășirea limitei setate de firmă), indicatorul albastru este vizibil, iar *Oprește GPS* / *Privat* / închiderea turei opresc colectarea. Textele permisiunilor sunt traduse RO/EN/PL (`apps/driver/locales`). Dă-le un cont de test dedicat (firmă de test + șofer), nu un șofer real.

**Google (Play Console → App content → Sensitive permissions → Location):** completezi declarația din `play-data-safety.md` și încarci **un video de max. 30 s** (YouTube, nelistat) care arată: login → Începe tura → Activează GPS → dialogul *Allow all the time* → notificarea persistentă → ecran blocat → poziția apare pe harta proprietarului → Oprește GPS. Video-ul trebuie filmat pe buildul real, de tine.

## 6. Avertizarea de viteză — formulare
Folosim „avertizare la depășirea limitei setate de tine (firmă)". **Nu** scriem că aplicația previne amenzi sau înlocuiește indicatoarele. Aceeași regulă pentru capturi și video.

## 7. Ce rămâne la tine
- [ ] D-U-N-S QUERRA S.R.L.
- [ ] Apple Developer (organizație, 99 USD/an) și Google Play Console (25 USD)
- [ ] Cont Expo + `eas init`; chei ASC API / service account ca secrete EAS
- [ ] Fișier Firebase de producție ca secret EAS
- [ ] Email de suport public în fișele magazinului
- [ ] Cont de test pentru Apple Review (firmă + șofer dedicat; nu în baza de producție cu date reale amestecate)
- [ ] Video locație în fundal pentru Google
- [ ] Revizuire juridică a politicii de confidențialitate (date de viteză, GDPR, informarea șoferilor de către angajator)
