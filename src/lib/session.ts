// Querra Fleet: sesiune semnată HMAC-SHA256 (Web Crypto, merge și în middleware edge și în Node).
/** admin = ADMIN_EMAIL (toate firmele); owner = proprietarul firmei; driver = șofer invitat; user = „Intră ca demo”. */
export type Role = "admin" | "owner" | "driver" | "user";
export const ROLES: Role[] = ["admin", "owner", "driver", "user"];
export interface Session { role: Role; email: string; firm: string; exp: number; uid?: string; trial?: string; version?: number }
export const SESSION_COOKIE = "igo-session";
export const SESSION_TTL_S = 60 * 60 * 24 * 7;

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ""; for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export const hasSecret = (secret: string | undefined): secret is string => !!secret && secret.length >= 32;

export async function signSession(s: Session, secret: string): Promise<string> { return signToken(s, secret); }
/** Token generic semnat (sesiune, invitație șofer). */
export async function signToken(payload: object, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
export async function verifySession(token: string | undefined, secret: string | undefined, nowS = Math.floor(Date.now() / 1000)): Promise<Session | null> {
  const s = await verifyToken<Session>(token, secret, nowS);
  return s && ROLES.includes(s.role) && typeof s.firm === "string" ? s : null;
}
export async function verifyToken<T extends { exp: number }>(token: string | undefined, secret: string | undefined, nowS = Math.floor(Date.now() / 1000)): Promise<T | null> {
  if (!token || !hasSecret(secret)) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64u(sig), enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64u(body))) as T;
    if (typeof s.exp !== "number" || s.exp < nowS) return null;
    return s;
  } catch { return null; }
}
