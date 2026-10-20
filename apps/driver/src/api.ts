import * as SecureStore from "expo-secure-store";
export type Login = { token: string; expiresAt: string; uid: string; firm: string; origin: string; logoutReceipt?: string };
export type Gate = { vehicleId: string; shiftStart: string; enabledAt: number; scope: string };
export type Pending = { path: "/api/driver/shift"; body: { vehicleId: string; expectedShiftStart: string; action: "stop" } }
  | { path: "/api/driver/private"; body: { vehicleId: string; expectedShiftStart: string; on: true } };
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export const read = async <T>(key: string): Promise<T | null> => {
  const value = await SecureStore.getItemAsync(key, options);
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { throw new Error("Datele locale nu pot fi citite. GPS nu a fost activat."); }
};
let loginTail: Promise<unknown> = Promise.resolve();
function loginChange(task: () => Promise<void>) {
  const job = loginTail.then(task); loginTail = job.catch(() => {}); return job;
}
export const write = (key: string, value: unknown) => key === "login"
  ? loginChange(() => SecureStore.setItemAsync(key, JSON.stringify(value), options))
  : SecureStore.setItemAsync(key, JSON.stringify(value), options);
export const remove = (key: string) => key === "login"
  ? loginChange(() => SecureStore.deleteItemAsync(key, options)) : SecureStore.deleteItemAsync(key, options);
export function rememberLogoutReceipt(token: string, receipt: string) {
  return loginChange(async () => {
    const login = await read<Login>("login");
    if (login?.token === token && !await read<boolean>("logout-in-progress"))
      await SecureStore.setItemAsync("login", JSON.stringify({ ...login, logoutReceipt: receipt }), options);
  });
}
export function apiOrigin() {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL ?? "https://invalid.example");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example")) throw new Error("Configurează adresa HTTPS a firmei în EXPO_PUBLIC_API_URL.");
  return url.origin;
}
export class ApiError extends Error {
  constructor(public status: number, public code = "") {
    super(code === "mobile-unavailable" ? "Accesul din aplicația mobilă nu este încă activat pentru acest server. Folosește momentan interfața web."
      : code === "credentials" ? "Telefonul sau PIN-ul/parola nu sunt corecte. Folosește contul de șofer primit de la firmă."
      : code === "transition" ? "Etapa cursei s-a schimbat sau există o așteptare deschisă. Reîmprospătează și verifică înainte de a continua."
      : code === "assignment" ? "Camionul sau cursa nu îți mai este alocată. Verifică împreună cu patronul."
      : status === 401 ? "Sesiunea a expirat. Autentifică-te din nou."
      : status === 429 ? "Prea multe încercări. Încearcă mai târziu."
      : "Serverul nu a confirmat operația. Reîncearcă.");
  }
}
/** Includes the backend: a staging token must never be sent to another deployment. */
export async function sessionScope(): Promise<string> {
  const login = await read<Login>("login");
  if (!login || login.origin !== apiOrigin() || !login.uid || !login.firm) throw new ApiError(401);
  return JSON.stringify([login.origin, login.firm, login.uid]);
}
let generation = 0;
export function abortRequests() { ++generation; for (const controller of requests.keys()) controller.abort(); }
const requests = new Map<AbortController, boolean>();
export function abortGPSRequests() { for (const [controller, gps] of requests) if (gps) controller.abort(); }
export async function api<T>(path: string, body?: unknown, opts: { anonymous?: boolean; gps?: boolean; scope?: string; multipart?: boolean } = {}): Promise<T> {
  const version = generation;
  const origin = apiOrigin(), login = opts.anonymous ? null : await read<Login>("login");
  if (!opts.anonymous && (!login || login.origin !== origin || !login.uid || !login.firm || typeof login.token !== "string" || !login.token
    || !Number.isFinite(Date.parse(login.expiresAt)) || Date.parse(login.expiresAt) <= Date.now())) throw new ApiError(401);
  if (opts.scope && JSON.stringify([login?.origin, login?.firm, login?.uid]) !== opts.scope) throw new ApiError(409, "account-changed");
  if (version !== generation || (!opts.anonymous && await read<boolean>("logout-in-progress"))) throw new ApiError(409, "account-changed");
  const controller = new AbortController(); requests.set(controller, !!opts.gps);
  const timeout = setTimeout(() => controller.abort(), opts.multipart ? 45000 : 12000);
  try {
    const response = await fetch(origin + path, { method: body === undefined ? "GET" : "POST", signal: controller.signal,
      headers: { Accept: "application/json", ...(body === undefined || opts.multipart ? {} : { "Content-Type": "application/json" }), ...(login ? { Authorization: `Bearer ${login.token}` } : {}) },
      body: body === undefined ? undefined : opts.multipart ? body as FormData : JSON.stringify(body) });
    if (version !== generation || (login && (await read<Login>("login"))?.token !== login.token)) throw new ApiError(409, "account-changed");
    const json = response.headers.get("content-type")?.includes("application/json");
    if (!response.ok || response.redirected || (response.status !== 204 && !json)) {
      const error = json ? await response.json().catch(() => null) : null;
      throw new ApiError(response.status === 200 ? 401 : response.status, typeof error?.error === "string" ? error.error : "");
    }
    const value = response.status === 204 ? undefined as T : await response.json() as T;
    if (version !== generation || (login && (await read<Login>("login"))?.token !== login.token)) throw new ApiError(409, "account-changed");
    return value;
  } catch (error) {
    if (version !== generation) throw new ApiError(409, "account-changed");
    if (error instanceof ApiError) throw error;
    throw new Error(controller.signal.aborted
      ? "Conexiunea a durat prea mult. Reîncearcă; operațiile salvate rămân pe telefon."
      : "Nu putem contacta firma. Verifică internetul și reîncearcă; operațiile salvate rămân pe telefon.");
  } finally { clearTimeout(timeout); requests.delete(controller); }
}
