import * as SecureStore from "expo-secure-store";
export type Login = { token: string; expiresAt: string; uid: string; firm: string; origin: string };
export type Gate = { vehicleId: string; shiftStart: string; enabledAt: number; scope: string };
export type Pending = { path: "/api/driver/shift"; body: { vehicleId: string; expectedShiftStart: string; action: "stop" } }
  | { path: "/api/driver/private"; body: { vehicleId: string; expectedShiftStart: string; on: true } };
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export const read = async <T>(key: string): Promise<T | null> => {
  const value = await SecureStore.getItemAsync(key, options);
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { throw new Error("Datele locale nu pot fi citite. GPS nu a fost activat."); }
};
export const write = (key: string, value: unknown) => SecureStore.setItemAsync(key, JSON.stringify(value), options);
export const remove = (key: string) => SecureStore.deleteItemAsync(key, options);
export function apiOrigin() {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL ?? "https://invalid.example");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example")) throw new Error("Configurează adresa HTTPS a firmei în EXPO_PUBLIC_API_URL.");
  return url.origin;
}
export class ApiError extends Error {
  constructor(public status: number, public code = "") { super(status === 401 ? "Sesiunea a expirat. Autentifică-te din nou." : status === 429 ? "Prea multe încercări. Încearcă mai târziu." : "Serverul nu a confirmat operația. Reîncearcă."); }
}
/** Includes the backend: a staging token must never be sent to another deployment. */
export async function sessionScope(): Promise<string> {
  const login = await read<Login>("login");
  if (!login || login.origin !== apiOrigin() || !login.uid || !login.firm) throw new ApiError(401);
  return JSON.stringify([login.origin, login.firm, login.uid]);
}
const requests = new Map<AbortController, boolean>();
export function abortGPSRequests() { for (const [controller, gps] of requests) if (gps) controller.abort(); }
export async function api<T>(path: string, body?: unknown, opts: { anonymous?: boolean; gps?: boolean; scope?: string } = {}): Promise<T> {
  const origin = apiOrigin(), login = opts.anonymous ? null : await read<Login>("login");
  if (!opts.anonymous && (!login || login.origin !== origin || !login.uid || !login.firm || typeof login.token !== "string" || !login.token
    || !Number.isFinite(Date.parse(login.expiresAt)) || Date.parse(login.expiresAt) <= Date.now())) throw new ApiError(401);
  if (opts.scope && JSON.stringify([login?.origin, login?.firm, login?.uid]) !== opts.scope) throw new ApiError(409, "account-changed");
  const controller = new AbortController(); requests.set(controller, !!opts.gps);
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(origin + path, { method: body === undefined ? "GET" : "POST", signal: controller.signal,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(login ? { Authorization: `Bearer ${login.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const json = response.headers.get("content-type")?.includes("application/json");
    if (!response.ok || response.redirected || (response.status !== 204 && !json)) {
      const error = json ? await response.json().catch(() => null) : null;
      throw new ApiError(response.status === 200 ? 401 : response.status, typeof error?.error === "string" ? error.error : "");
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  } finally { clearTimeout(timeout); requests.delete(controller); }
}
