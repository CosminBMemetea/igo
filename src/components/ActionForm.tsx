"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tri, type Locale } from "@/lib/i18n";

const ERR: Record<string, string> = {
  "task-driver": "Verifică șoferul alocat camionului. Dacă există o sarcină pentru fostul șofer, anuleaz-o înainte de realocare.|Check the assigned driver. Cancel any task for the previous driver before assigning it again.|Sprawdź przypisanego kierowcę. Anuluj zadanie poprzedniego kierowcy przed ponownym przypisaniem.",
  "task-exists": "Există deja o sarcină deschisă pentru acest document. Termenul ei a fost păstrat; anuleaz-o dacă vrei să creezi una cu alt termen.|An open task already exists for this document. Its due date was preserved; cancel it to create one with another date.|Otwarte zadanie dla tego dokumentu już istnieje. Zachowano jego termin; anuluj je, aby utworzyć zadanie z inną datą.",
  classification: "Verifică datele din talon: categoria, MTMA în kg, locurile și norma EURO trebuie să fie compatibile.|Check registration details: category, MTMA in kg, seats and EURO must be consistent.|Sprawdź dane dowodu: kategoria, DMC w kg, miejsca i EURO muszą być zgodne.",
  reason: "Scrie motivul anulării.|Enter the cancellation reason.|Podaj powód anulowania.",
  transition: "Starea cursei s-a schimbat sau operațiunea nu este permisă. Reîncarcă pagina.|Trip status changed or this action is not allowed. Reload the page.|Status kursu się zmienił lub operacja jest niedozwolona. Odśwież stronę.",
  plate: "Verifică numărul de înmatriculare.|Check the registration number.|Sprawdź numer rejestracyjny.",
  vin: "VIN-ul trebuie să aibă 17 caractere valide.|VIN must contain 17 valid characters.|VIN musi mieć 17 poprawnych znaków.",
  num: "Verifică valorile numerice.|Check the numeric values.|Sprawdź wartości liczbowe.",
  dup: "Există deja o înregistrare cu aceste date.|A record with these details already exists.|Taki wpis już istnieje.",
  name: "Completează numele șoferului.|Enter the driver's name.|Wpisz imię i nazwisko kierowcy.",
  phone: "Introdu telefonul cu prefix de țară, de exemplu +407…|Enter the phone with country code, e.g. +407…|Wpisz telefon z prefiksem kraju, np. +48…",
  dupphone: "Telefonul este deja folosit. Verifică șoferii existenți.|This phone is already in use. Check existing drivers.|Telefon jest już używany. Sprawdź kierowców.",
  assignment: "Camionul este ocupat, în tură sau indisponibil. Încheie tura înainte de schimbare.|Truck is assigned, on shift or unavailable. End the shift before changing.|Pojazd jest przypisany, na zmianie lub niedostępny. Zakończ zmianę przed zmianą pojazdu.",
  missing: "Înregistrarea nu mai este disponibilă. Reîncarcă pagina.|Record no longer available. Reload the page.|Wpis nie jest już dostępny. Odśwież stronę.",
};
export function ActionForm({ action, returnTo, loc, children, reset = false }: { action: string; returnTo?: string; loc: Locale; children: React.ReactNode; reset?: boolean }) {
  const router = useRouter(), lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="sheet" action={action} method="post" aria-busy={busy} onSubmit={async (e) => {
    e.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const form = e.currentTarget, data = new FormData(form);
    try {
      const response = await fetch(action, { method: "POST", headers: { accept: "application/json" }, body: data });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "server");
      if (reset) form.reset();
      if (body.redirect) router.push(body.redirect);
      router.refresh();
    } catch (err) {
      setError(tri(loc, ERR[(err as Error).message] ?? "Nu s-a salvat. Datele introduse sunt păstrate; încearcă din nou.|Not saved. Your entries are preserved; try again.|Nie zapisano. Wpisane dane zostały zachowane; spróbuj ponownie."));
    } finally { lock.current = false; setBusy(false); }
  }}>
    {returnTo ? <input type="hidden" name="ret" value={returnTo} /> : null}
    {error ? <p className="msg err" role="alert">{error}</p> : null}
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
    {busy ? <p className="action-status" role="status">{tri(loc, "Se salvează…|Saving…|Zapisywanie…")}</p> : null}
  </form>;
}
