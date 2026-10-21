# CI pe GitHub — pașii pentru Cosmin (2 minute, o singură dată)

Ce face: la fiecare push pe `main` (și la fiecare pull request), GitHub rulează automat verificarea de tipuri, lint, build și toate testele smoke, inclusiv izolarea între firme. Rulează pe o bază Postgres temporară a GitHub, **niciodată pe Neon sau producție**. Nu are nevoie de niciun secret.

1. Deschide fișierul https://github.com/CosminBMemetea/igo/blob/main/ops/github-ci.yml.txt, apasă butonul **Copy raw file** (iconița cu două foi, sus în dreapta).
2. Mergi la https://github.com/CosminBMemetea/igo → **Add file** → **Create new file**.
3. La nume scrie exact: `.github/workflows/ci.yml` (cu punct la început; când tastezi `/`, GitHub face singur folderele).
4. Lipește conținutul (Cmd+V). Prima linie, cea care începe cu `#`, poate rămâne.
5. Apasă **Commit changes…** → lasă „Commit directly to the main branch” → **Commit changes**.
6. Verifică: tab-ul **Actions** → rularea „CI” trebuie să devină verde (✓) în ~10 minute. Dacă e roșie, trimite-mi linkul rulării.

Notă: eu nu pot face pasul acesta, pentru că tokenul meu nu are dreptul „workflow” pe GitHub. Vercel nu este afectat: deploy-ul continuă ca acum.
