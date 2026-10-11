// Link de invitație pentru șofer: token semnat HMAC (SESSION_SECRET), valabil 14 zile, folosibil o singură dată (invites.used_at).
import { signToken, verifyToken } from "./session";
export interface InviteToken { k: "inv"; firm: string; inv: string; exp: number }
export const INVITE_TTL_S = 14 * 24 * 3600;
export const inviteToken = (firm: string, inv: string, secret: string, nowS = Math.floor(Date.now() / 1000)) => signToken({ k: "inv", firm, inv, exp: nowS + INVITE_TTL_S } satisfies InviteToken, secret);
export async function readInvite(t: string | undefined, secret: string | undefined, nowS?: number): Promise<InviteToken | null> {
  const p = await verifyToken<InviteToken>(t, secret, nowS);
  return p && p.k === "inv" && typeof p.firm === "string" && typeof p.inv === "string" ? p : null;
}
