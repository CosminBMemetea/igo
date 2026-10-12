// Querra Fleet: aspectul unic al fiecărui rol (etichetă, culoare, icon) — folosit în login, antet, linia de sus și bannere.
import type { MsgKey } from "./i18n";
export type RoleLook = "admin" | "owner" | "driver";
export const ROLE_LOOK: Record<RoleLook, { label: MsgKey; color: string; icon: "shield" | "building" | "wheel" }> = {
  admin: { label: "rl.admin", color: "#8b5cf6", icon: "shield" },
  owner: { label: "rl.owner", color: "#3b82f6", icon: "building" },
  driver: { label: "rl.driver", color: "#22c55e", icon: "wheel" },
};
/** Vizitatorul demo („user”) arată ca un patron pe firma demo. */
export const lookOf = (r: string | null): RoleLook | null => (r === "admin" ? "admin" : r === "driver" ? "driver" : r === "owner" || r === "user" ? "owner" : null);
export function RoleIcon({ k }: { k: RoleLook }) {
  const d = { admin: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z", owner: "M4 20V8l8-4 8 4v12M9 20v-6h6v6M4 20h16", driver: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4.5 10h5M14.5 10h5M12 14v6" }[k];
  return <svg className="ricon" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}
