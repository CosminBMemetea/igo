// Querra Fleet: validări și normalizări pentru formulare (pure; testate în smoke:tenant).
export const normEmail = (s: string) => s.trim().toLowerCase();
export const isEmail = (s: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(s);
/** Telefon: doar cifre și „+” inițial; 07xx… → +407xx…. */
export function normPhone(s: string): string {
  let p = s.replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(p)) p = "+4" + p;
  if (/^00/.test(p)) p = "+" + p.slice(2);
  return p;
}
export const isPhone = (s: string) => /^\+\d{8,15}$/.test(s);
export const normLogin = (s: string) => (s.includes("@") ? normEmail(s) : normPhone(s));
/** Număr de înmatriculare: majuscule, spații unice. RO: „BH 21 QRT”, „B 120 QRT”; acceptăm și străine (4–12 caractere). */
export function normPlate(s: string): string | null {
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ro = /^(B|[A-Z]{2})(\d{2,3})([A-Z]{3})$/.exec(c);
  if (ro) return `${ro[1]} ${ro[2]} ${ro[3]}`;
  return c.length >= 4 && c.length <= 12 ? c : null;
}
export const normVin = (s: string) => { const v = s.toUpperCase().replace(/[^A-Z0-9]/g, ""); return v === "" ? null : /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : undefined; };
/** Număr opțional: "" → null; invalid/în afara intervalului → undefined. */
export function optNum(v: FormDataEntryValue | null, min: number, max: number): number | null | undefined {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);
export const PASSWORD_MIN = 8;
export const isPin = (s: string) => /^\d{6}$/.test(s);
/** PIN slab: toate cifrele la fel, șir crescător/descrescător, 2–3 cifre repetate (121212, 123123), ani 19xx/20xx la final de tip dată. */
export const weakPin = (s: string) => {
  if (!isPin(s)) return true;
  const d = [...s].map(Number), steps = d.slice(1).map((x, i) => x - d[i]);
  if (new Set(d).size <= 2) return true;
  if (steps.every((x) => x === 1) || steps.every((x) => x === -1)) return true;
  if (s.slice(0, 3) === s.slice(3) || s.slice(0, 2).repeat(3) === s) return true;
  return ["123456", "654321", "112233", "123321", "121212", "696969", "159753", "147258", "258369", "102030", "131313"].includes(s);
};
/** Ora locală (Europe/Bucharest) „YYYY-MM-DDTHH:MM”, ca în exporturile de card. */
export function localNow(d = new Date(), tz = "Europe/Bucharest"): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
