// Fallback fără DATABASE_URL: totul în memorie (se pierde la repornire; adminul vede bannerul).
import { newId, today, type DocRow, type FirmRow, type InviteRow, type Store, type SupportRow, type TripRow, type TruckRow, type UserRow } from "./types";
export class MemStore implements Store {
  readonly persistent = false;
  private F: FirmRow[] = []; private U: UserRow[] = []; private I: InviteRow[] = []; private T: TruckRow[] = [];
  private D: DocRow[] = []; private R: TripRow[] = []; private S: SupportRow[] = [];
  async createFirm(f: Pick<FirmRow, "name" | "cui">) { const r: FirmRow = { id: newId("f"), name: f.name, cui: f.cui, currency: "RON", trialStart: today(), demoMode: false, detailsDone: false, csvSkipped: false, createdAt: new Date().toISOString() }; this.F.push(r); return { ...r }; }
  async firm(id: string) { const f = this.F.find((x) => x.id === id); return f ? { ...f } : null; }
  async firms() { return this.F.map((f) => ({ ...f, trucks: this.T.filter((t) => t.firmId === f.id).length, users: this.U.filter((u) => u.firmId === f.id).length })); }
  async updateFirm(id: string, p: Partial<FirmRow>) { const f = this.F.find((x) => x.id === id); if (f) Object.assign(f, p); }
  async createUser(u: Omit<UserRow, "id">) {
    if ((u.email && this.U.some((x) => x.email === u.email)) || (u.phone && this.U.some((x) => x.phone === u.phone))) throw new Error("exists");
    const r = { ...u, id: newId("u") }; this.U.push(r); return { ...r };
  }
  async userByLogin(login: string) { const u = this.U.find((x) => x.email === login || x.phone === login); return u ? { ...u } : null; }
  async users(firmId: string) { return this.U.filter((u) => u.firmId === firmId); }
  async createInvite(firmId: string, name: string, phone: string | null) { const r: InviteRow = { id: newId("i"), firmId, name, phone, usedAt: null, userId: null, createdAt: new Date().toISOString() }; this.I.push(r); return { ...r }; }
  async invite(firmId: string, id: string) { const r = this.I.find((x) => x.id === id && x.firmId === firmId); return r ? { ...r } : null; }
  async invites(firmId: string) { return this.I.filter((x) => x.firmId === firmId); }
  async useInvite(firmId: string, id: string, userId: string) { const r = this.I.find((x) => x.id === id && x.firmId === firmId && !x.usedAt); if (!r) return false; r.usedAt = new Date().toISOString(); r.userId = userId; return true; }
  async addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">) { if (this.T.some((x) => x.firmId === firmId && x.plate === t.plate)) throw new Error("exists"); const r = { ...t, id: newId("t"), firmId }; this.T.push(r); return { ...r }; }
  async trucks(firmId: string) { return this.T.filter((x) => x.firmId === firmId); }
  async addDoc(firmId: string, d: Omit<DocRow, "id" | "firmId">) { if (!this.T.some((x) => x.id === d.truckId && x.firmId === firmId)) throw new Error("truck"); const r = { ...d, id: newId("d"), firmId }; this.D.push(r); return { ...r }; }
  async docs(firmId: string) { return this.D.filter((x) => x.firmId === firmId); }
  async addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">) { if (!this.T.some((x) => x.id === t.truckId && x.firmId === firmId)) throw new Error("truck"); const r = { ...t, id: newId("r"), firmId }; this.R.push(r); return { ...r }; }
  async trips(firmId: string) { return this.R.filter((x) => x.firmId === firmId).sort((a, b) => b.date.localeCompare(a.date)); }
  async addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">) { const r: SupportRow = { ...s, id: newId("s"), status: "new", createdAt: new Date().toISOString() }; this.S.push(r); return { ...r }; }
  async support() { return [...this.S].reverse(); }
}
