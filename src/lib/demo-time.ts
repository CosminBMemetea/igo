// Demo: datele sunt generate pentru o zi de referință fixă (REF_DAY) și apoi mutate pe „azi” (ora României),
// ca nicio cursă/notificare să nu pară din viitor. Logica internă (reguli, alerte) rămâne pe ziua de referință.
import { localNow } from "./validate";
export const REF_DAY = "2026-10-15";
const DAY = 86400000;
export const realToday = () => localNow().slice(0, 10);
/** Câte zile trebuie mutate datele demo ca REF_DAY să devină azi. */
export const demoDelta = (today = realToday()) => Math.round((Date.parse(today) - Date.parse(REF_DAY)) / DAY);
const RE = /^(\d{4}-\d{2}-\d{2})/;
export function shiftStr(s: string, d: number): string {
  if (!d) return s;
  const m = RE.exec(s);
  return m ? new Date(Date.parse(m[1]) + d * DAY).toISOString().slice(0, 10) + s.slice(10) : s;
}
/** Copie profundă cu toate șirurile de tip dată (YYYY-MM-DD…) mutate cu d zile. */
export function shiftDeep<T>(v: T, d: number): T {
  if (!d) return v;
  if (typeof v === "string") return shiftStr(v, d) as T;
  if (Array.isArray(v)) return v.map((x) => shiftDeep(x, d)) as T;
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const k of Object.keys(v)) o[k] = shiftDeep((v as Record<string, unknown>)[k], d); return o as T; }
  return v;
}
/** Memo per „delta” (se schimbă doar la miezul nopții). */
export function byDelta<T>(f: (d: number) => T): () => T {
  let k: number | null = null, val: T;
  return () => { const d = demoDelta(); if (k !== d) { k = d; val = f(d); } return val; };
}
