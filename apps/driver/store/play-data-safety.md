# Google Play — Data safety (răspunsuri propuse; verificați înainte de trimitere)

- Colectează sau partajează date? **Da (colectează). Nu partajează cu terți.** (Procesatorii: Vercel, Neon UE, Firebase pentru push — „service providers", nu „sharing".)
- Date criptate în tranzit? **Da (HTTPS).**
- Utilizatorul poate cere ștergerea? **Da** — prin firmă sau <EMAIL_SUPORT — de completat de Cosmin>; contul firmei se șterge cu toate datele.

| Tip de date (Play) | Colectat | Scop | Opțional? | Note |
|---|---|---|---|---|
| Location → Precise location | Da | App functionality | Da (GPS doar în tură, poate fi oprit) | Și în fundal; avertizare viteză |
| Personal info → Name | Da | App functionality, Account management | Nu | Creat de firmă |
| Personal info → Phone number | Da | Account management | Nu | Login |
| Photos and videos → Photos | Da | App functionality | Da | CMR / POD |
| Files and docs | Da | App functionality | Da | Documente cursă |
| App activity → Other actions | Da | App functionality | Nu | Ture, confirmări curse |
| Device or other IDs | Da | App functionality | Da | Token push FCM |

Nu: advertising, analytics terță parte, tracking, vânzare de date.

## Declarația locație în fundal (Play Console → App content → Sensitive permissions)
**Funcție:** „În timpul turei, șoferul activează GPS; aplicația trimite poziția camionului firmei de transport (harta flotei, confirmarea curselor) și afișează avertizare la depășirea limitei de viteză setate de firmă, inclusiv cu ecranul blocat. Colectarea pornește doar la acțiunea explicită a șoferului, afișează notificare persistentă și se oprește cu «Oprește GPS», «Privat» sau la închiderea turei."
**Video (≤30 s, YouTube nelistat):** login → Începe tura → Activează GPS → dialog permisiune «Tot timpul» → notificarea persistentă → blocare ecran → harta proprietarului se actualizează → Oprește GPS.
