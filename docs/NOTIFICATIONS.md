# Notificări — implementare și activare

Actualizat: 18 octombrie 2026. Cod pregătit; configurarea serviciilor și acceptanța pe dispozitiv sunt etape separate. Utilizatorul a confirmat că nu are încă Resend/domeniu verificat sau Apple Developer.

## Ce este implementat

| Canal | Patron | Șofer | Condiții |
|---|---|---|---|
| În aplicație | Documentele flotei; confirmarea preluării verificărilor | Documente personale, camion atribuit, verificări solicitate | Cont activ și date înregistrate |
| Email | Alerte despre întreaga flotă | Doar documentele personale/camionului atribuit și verificările lui | Resend, expeditor verificat, adresă în cont, preferință activă |
| Web Push pe Mac / desktop | Da | Da | HTTPS, VAPID, browser compatibil, activare explicită pe dispozitiv |
| Web Push pe iPhone | Da | Da | iOS 16.4+, aplicația adăugată pe ecranul principal, deschisă de acolo, permisiune acordată |
| Push în aplicația nativă iOS | Nu există aplicație nativă dedicată patronului | Implementat prin APNs direct | Apple Developer, App ID cu Push Notifications, semnare/provisioning, cheie APNs și server configurat |
| Push în aplicația nativă Android | — | Nu este activat în această etapă | FCM rămâne separat; Android poate folosi Web Push prin aplicația web |

Pagina `/notifications` permite activarea, testarea și oprirea push pe dispozitiv, revocarea pe toate dispozitivele contului și configurarea emailului. O adresă nouă cere parola/PIN-ul curent. Alertele de email pot fi oprite separat. Nu există verificare automată a proprietății căsuței poștale; verificați adresa împreună cu utilizatorul la pilot.

Nu se cere permisiunea push la încărcarea paginii. Conținutul afișat pe ecranul blocat este generic; numerele de înmatriculare și documentele se văd după autentificare. O notificare acceptată de furnizor **nu dovedește** afișarea pe telefon, citirea sau livrarea în inbox.

## Activare, în ordine

1. **Email:** creați contul Resend și adăugați domeniul/subdomeniul de expediere pe care îl controlați. Introduceți în DNS exact înregistrările cerute de Resend și așteptați verificarea. Configurați în mediul serverului `RESEND_API_KEY` și `EMAIL_FROM` cu expeditorul verificat. Verificați SPF/DKIM și politica DMARC a domeniului. Cheile nu se trimit în chat și nu intră în Git.
2. **Linkuri:** setați `APP_URL` la originea HTTPS reală a aplicației. Emailurile și resetările de parolă folosesc această origine, nu antetul Host primit. Linkul alertelor este `/notifications`, accesibil ambelor roluri.
3. **Web Push:** perechea VAPID a fost generată local în `.env.notifications.local`, cu permisiuni `0600`, ignorată de Git. Transferați `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` în mediul serverului din Vercel. Fișierul nu este încărcat automat de Next.js. Folosiți aceeași pereche între deployuri; rotirea ei necesită reactivarea abonamentelor. `npm run notifications:keys` creează un fișier nou și refuză suprascrierea.
4. **Scheduler:** păstrați jobul zilnic `/api/cron/reminders` la 03:00 UTC. Programați **și** `/api/cron/deliveries` la fiecare 5 minute, cu `Authorization: Bearer <CRON_SECRET>`. Folosiți o valoare aleatorie de minimum 32 de caractere. Modelul pentru un plan Vercel care permite frecvența este în `ops/vercel-notifications-cron.example.json`. Pe Hobby, documentația Vercel limitează un job la o execuție pe zi: folosiți un plan adecvat sau un scheduler extern autentificat. Configurația implicită a proiectului păstrează jobul zilnic pentru a nu impune un upgrade plătit. **Până la configurarea schedulerului de 5 minute, retry-ul rapid nu este activ în producție.**
5. **Admin:** verificați starea furnizorilor, ultima execuție a joburilor și coada în `/admin#emails`. Un job de livrare fără confirmare de peste 15 minute este semnalat. Joburile de documente au prag de 27 de ore. Un worker întrerupt rămâne vizibil ca neconfirmat. Nu sunt trimise automat emailuri de monitorizare dacă furnizorul însuși nu funcționează.
6. **iOS nativ:** activați Push Notifications pentru App ID `com.querra.qfleet.driver`. Creați/folosiți o cheie Apple APNs `.p8` și configurați serverul: `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`, `APNS_ENVIRONMENT`. Cheia poate folosi newline-uri reale sau `\n`. `sandbox` este pentru semnare de dezvoltare; `production` pentru TestFlight/App Store. `EXPO_PUBLIC_APNS_ENVIRONMENT` din build trebuie să corespundă serverului. Aplicația folosește tokenul Apple, fără serviciul Expo Push și fără obligația unui proiect EAS.
7. **Semnare:** buildul de simulator este nesemnat pentru dispozitiv și nu se instalează pe un iPhone. Pentru TestFlight/iPhone sunt necesare echipa Apple, certificatul/profilul cu entitlement `aps-environment` și un build semnat. Nu activați `MOBILE_DRIVER_ENABLED=1` în producție înainte de acceptanța pilotului nativ.
8. **Test autorizat:** dintr-un cont de test al firmei, activați push pe Mac și apăsați „Testează push”. Apoi testați patronul și șoferul pe iPhone, cu aplicația în fundal/ecranul blocat. Folosiți numai adrese și dispozitive de test autorizate. Nu generați alerte de test către șoferi/clienți reali fără acord.

Comenzi:

```sh
npm run notifications:keys
node --env-file=.env.notifications.local scripts/check-notifications.mjs
npm run notifications:check
npm run smoke:notifications
npm run smoke:native-notifications
# TEST_DATABASE_URL trebuie să fie un PostgreSQL local, de unică folosință:
TEST_DATABASE_URL=... npm run smoke:notifications
# Server local explicit de test, fără DATABASE_URL:
NOTIFICATIONS_TEST_URL=http://localhost:3107 npm run smoke:notifications:http
```

`notifications:check` afișează numai starea configurației, nu valorile cheilor, și nu trimite mesaje. Lipsa configurației produce codul de ieșire 2. Nu rulați suitele care resetează schema pe baza de producție.

## Garanții și limite ale cozii

- Migrarea `0020_notification_delivery.sql` extinde `email_outbox` pentru ambele canale și adaugă `push_devices`, preferințe și `notification_jobs`.
- Deduplicare prin cheie unică. Claim atomic PostgreSQL cu `FOR UPDATE SKIP LOCKED`, lease de 90 secunde și token de proprietate. Un worker vechi nu poate finaliza jobul preluat de alt worker.
- Timeout de 10 secunde către furnizori; retry exponențial cu jitter, maximum 8 încercări; `Retry-After` este respectat. 408/425/429/5xx și erorile de transport sunt reîncercate. Erorile permanente devin vizibile ca eșuate; abonamentele 404/410 și tokenurile APNs revocate sunt eliminate.
- Emailul folosește o cheie Resend stabilă pe job. Resend păstrează idempotency keys 24h; sistemul oprește retry după 23h de la prima încercare, pentru a evita retrimiterea unui email acceptat în urma unui timeout. Joburile rămân vizibile pentru analiză. Nu oferim garanția „exactly once” pentru push; topic/tag/collapse-id reduc dublurile.
- Jobul zilnic reconstruiește alertele lipsă după o întrerupere. Praguri: 30/14/7/1/0 zile. La retry sunt reverificate firma, contul, preferința, adresa, asignarea camionului, documentul curent, pragul și starea sarcinii. Documentele reînnoite, viitoare/suprascrise, camioanele arhivate și conturile dezactivate nu mai primesc alerte vechi.
- Emailurile de resetare a parolei patronului sunt legate de versiunea contului și au expirare de 55 minute. Linkul de resetare rămâne valabil maximum o oră. Emailurile istorice queued/failed fără context sunt anulate prin migrare; nu sunt retrimise orbește. Joburile curente se regenerează după validarea datelor.
- Abonamentele unui browser sunt revocate la logout și autentificarea altui cont. Reasocierea aceluiași endpoint schimbă identitatea abonamentului, astfel încât mesajele fostului cont nu îl urmează.
- În aplicația nativă push este legat de sesiunea mobilă de 12 ore. La expirare livrarea se oprește; după autentificare se reînregistrează numai preferința deja activată pentru același cont. Oprirea offline nu este raportată ca și cum serverul ar fi confirmat-o.
- Datele sensibile nu apar în erorile persistate ale furnizorilor. Endpointurile web push sunt HTTPS pe o listă explicită de furnizori; redirecturile sunt interzise. Cheile P-256 și auth sunt validate. API-urile web au protecție de origine, iar API-ul nativ acceptă numai tokenurile mobile permise.
- Workerul procesează loturi limitate (maximum 80, buget de 40 secunde). Pentru flote foarte mari, generatorul zilnic trebuie paginat înainte de a depăși durata funcției; nu afirmăm capacitate nelimitată.

## Acceptanță rămasă după configurare

- Resend: livrare efectivă/inbox, spam, bounce/suppression. Webhookurile de bounce/delivery nu sunt implementate în această etapă; „acceptat” nu înseamnă „livrat”.
- Vercel/scheduler: invocare reală la 5 minute și reluare după o întrerupere. Verificați Admin după minimum două execuții.
- iPhone: PWA instalată, aplicație nativă semnată, permisiune refuzată/reacordată, mod Focus, ecran blocat, offline/revenire online, logout și schimbarea utilizatorului pe același telefon.
- Două dispozitive: patron + șofer, realocare camion în timp ce există retry, confirmarea sarcinii, reînnoirea documentului.
- Token APNs real și mediu sandbox/producție. Testele de semnare JWT și buildul de simulator nu înlocuiesc această verificare.
- FCM nativ Android, verificarea căsuței de email la schimbarea adresei și recuperarea PIN-ului șoferului prin email rămân extensii separate. Formularul actual de resetare este pentru parola patronului; nu îl folosim pentru a înlocui un PIN cu o parolă incompatibilă.

Surse tehnice: [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [WebKit iOS Home Screen](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [APNs requests](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns), [Expo APNs direct](https://docs.expo.dev/push-notifications/sending-notifications-custom/), [Resend idempotency](https://resend.com/changelog/idempotency-keys), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
