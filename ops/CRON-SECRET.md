# CRON_SECRET în Vercel — pasul pentru Cosmin (2 minute, o singură dată)

**De ce:** joburile programate (`/api/cron/reminders` la 03:00 UTC și `/api/cron/speed-alerts` la 04:30 UTC, adică 06:30/07:30 ora României) refuză orice apel fără `CRON_SECRET`. Dacă variabila lipsește, joburile răspund 401 și nu fac nimic: reamintirile zilnice și reîncercarea alertelor de viteză netrimise nu rulează. Eu nu am acces la Vercel și nu setez secrete; pasul acesta îl faci tu.

1. Generează o valoare aleatorie de cel puțin 32 de caractere (de ex. în Terminal: `openssl rand -hex 32`). Nu o trimite nimănui, nici mie.
2. Vercel → proiectul **igo** → **Settings** → **Environment Variables** → **Add New**.
3. Name: `CRON_SECRET` · Value: valoarea de la pasul 1 · Environment: **Production** (bifat). **Save**.
4. **Deployments** → ultimul deploy de pe `main` → **⋯** → **Redeploy** (variabilele noi intră doar la un deploy nou).
5. Verifică: Vercel → **Settings** → **Cron Jobs** trebuie să arate ambele joburi. După 04:30 UTC, la `/api/cron/speed-alerts` apare un răspuns 200 în **Logs** (nu 401).

Dacă `CRON_SECRET` există deja (setat pentru reamintiri), nu trebuie schimbat nimic: același secret acoperă și jobul nou.

Note:
- Pe planul Hobby, Vercel rulează fiecare cron o dată pe zi (cu o abatere de până la ~59 de minute). De aceea alertele de viteză se reîncearcă **și** la fiecare citire GPS primită de la orice camion al firmei (cu pauze crescătoare: 30 s, 2 min, 10 min, 30 min, 2 h, 6 h, 12 h; maximum 8 încercări). Jobul zilnic acoperă firmele ale căror camioane nu mai trimit poziții.
- Inboxul din aplicație nu depinde de `APP_URL`; doar emailul (care conține un link) are nevoie de un `APP_URL` https valid.
