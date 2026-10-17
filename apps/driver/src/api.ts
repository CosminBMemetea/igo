import * as SecureStore from "expo-secure-store";
export type Login = { token: string; expiresAt: string };
export type Gate = { vehicleId: string; shiftStart: string; enabledAt: number };
export type Pending = { path: "/api/driver/shift" | "/api/driver/private"; body: Record<string, unknown> };
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export const read = async <T>(key: string): Promise<T | null> => {
  const value = await SecureStore.getItemAsync(key, options);
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
};
export const write = (key: string, value: unknown) => SecureStore.setItemAsync(key, JSON.stringify(value), options);
export const remove = (key: string) => SecureStore.deleteItemAsync(key, options);
export function apiOrigin() {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL ?? "https://invalid.example");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example")) throw new Error("Configurează adresa HTTPS a firmei în EXPO_PUBLIC_API_URL.");
  return url.origin;
}
export class ApiError extends Error { constructor(public status: number) { super(status === 401 ? "Sesiunea a expirat. Autentifică-te din nou." : status === 429 ? "Prea multe încercări. Încearcă mai târziu." : "Serverul nu a confirmat operația. Reîncearcă."); } }
const requests = new Set<AbortController>();
export function abortRequests() { for (const controller of requests) controller.abort(); }
export async function api<T>(path: string, body?: unknown, anonymous = false): Promise<T> {
  const login = anonymous ? null : await read<Login>("login");
  if (!anonymous && (!login || Date.parse(login.expiresAt) <= Date.now())) throw new ApiError(401);
  const controller = new AbortController(); requests.add(controller);
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(apiOrigin() + path, { method: body === undefined ? "GET" : "POST", signal: controller.signal,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(login ? { Authorization: `Bearer ${login.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok || response.redirected || (response.status !== 204 && !response.headers.get("content-type")?.includes("application/json"))) throw new ApiError(response.status === 200 ? 401 : response.status);
    return response.status === 204 ? undefined as T : await response.json() as T;
  } finally { clearTimeout(timeout); requests.delete(controller); }
}
