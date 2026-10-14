import { nextCostMonth } from "../costs";
// Fallback fără DATABASE_URL: totul în memorie (se pierde la repornire; adminul vede bannerul).
import { newId, today, type LeadRow, type NewLead, type CardRow, type FuelTxRow, type ImportRow, type NewFuelTx, type PosRow, type DriverEventRow, type ShiftRow, type DocRow, type NewDoc, type FileMeta, type NewFile, type NotificationRow, type NewNotification, type EmailRow, type EmailStatus, type TripEventRow, type FirmRow, type InviteRow, type Store, type SupportRow, type TripRow, type TruckRow, type UserRow } from "./types";
export class MemStore implements Store {
  readonly persistent = false;
  private F: FirmRow[] = []; private U: UserRow[] = []; private I: InviteRow[] = []; private T: TruckRow[] = [];
  private D: DocRow[] = []; private R: TripRow[] = []; private S: SupportRow[] = []; private LD: LeadRow[] = [];
  async createFirm(f: Pick<FirmRow, "name" | "cui"> & { referredBy?: string | null }) { const r: FirmRow = { id: newId("f"), name: f.name, cui: f.cui, currency: "RON", trialStart: today(), demoMode: false, detailsDone: false, csvSkipped: false, referredBy: f.referredBy ?? null, createdAt: new Date().toISOString() }; this.F.push(r); return { ...r }; }
  async firm(id: string) { const f = this.F.find((x) => x.id === id); return f ? { ...f } : null; }
  async firms() { return this.F.map((f) => ({ ...f, trucks: this.T.filter((t) => t.firmId === f.id).length, users: this.U.filter((u) => u.firmId === f.id).length })); }
  async updateFirm(id: string, p: Partial<FirmRow>) { const f = this.F.find((x) => x.id === id); if (f) Object.assign(f, p); }
  async createUser(u: Omit<UserRow, "id">) {
    if ((u.email && this.U.some((x) => x.email === u.email)) || (u.phone && this.U.some((x) => x.phone === u.phone))) throw new Error("exists");
    const r = { ...u, id: newId("u") }; this.U.push(r); return { ...r };
  }
  async userByLogin(login: string) { const u = this.U.find((x) => x.email === login || x.phone === login); return u ? { ...u } : null; }
  async setUserPassword(id: string, passwordHash: string) { const u = this.U.find((x) => x.id === id); if (u) { u.passwordHash = passwordHash; u.sessionVersion = (u.sessionVersion ?? 0) + 1; } }
  async firmCounts(firmId: string) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(this)) {
      if (Array.isArray(v)) { const n = v.filter((x: { firmId?: string; id?: string }) => x.firmId === firmId || (k === "F" && x.id === firmId)).length; if (n) out[k] = n; }
      else if (v instanceof Map) { const n = [...v.keys()].filter((x) => String(x).startsWith(firmId + ":")).length; if (n) out[k] = n; }
    }
    return out;
  }
  async deleteFirm(firmId: string) {
    const counts = await this.firmCounts(firmId), self = this as unknown as Record<string, unknown>;
    const blobUrls = this.FL.filter((f) => f.firmId === firmId && f.url).map((f) => f.url!);
    for (const [k, v] of Object.entries(this)) {
      if (Array.isArray(v)) self[k] = v.filter((x: { firmId?: string; id?: string }) => !(x.firmId === firmId || (k === "F" && x.id === firmId)));
      else if (v instanceof Map) for (const key of [...v.keys()]) if (String(key).startsWith(firmId + ":")) v.delete(key);
    }
    return { counts, blobUrls };
  }
  async userById(id: string) { const u = this.U.find((x) => x.id === id); return u ? { ...u } : null; }
  async setUserDisabled(firmId: string, userId: string, off: boolean) {
    const u = this.U.find((x) => x.id === userId && x.firmId === firmId && x.role === "driver"); if (!u) return false;
    if (off && u.truckId) { const sh = this.H.get(`${firmId}:${u.truckId}`); if (sh && !sh.end) { sh.end = new Date().toISOString(); sh.privateSince = null; } u.truckId = null; }
    u.disabledAt = off ? new Date().toISOString() : null; u.sessionVersion = (u.sessionVersion ?? 0) + 1; return true;
  }
  async users(firmId: string) { return this.U.filter((u) => u.firmId === firmId); }
  async setUserLocale(id: string, locale: string) { const u = this.U.find((x) => x.id === id); if (u) u.locale = locale; }
  async createInvite(firmId: string, name: string, phone: string | null, locale: string | null = null) { const r: InviteRow = { id: newId("i"), firmId, name, phone, locale, usedAt: null, userId: null, createdAt: new Date().toISOString() }; this.I.push(r); return { ...r }; }
  async invite(firmId: string, id: string) { const r = this.I.find((x) => x.id === id && x.firmId === firmId); return r ? { ...r } : null; }
  async invites(firmId: string) { return this.I.filter((x) => x.firmId === firmId); }
  async createDriverInvite(firmId: string, name: string, phone: string, locale: string) {
    if (this.U.some((u) => u.phone === phone)) throw new Error("exists");
    const u: UserRow = { id: newId("u"), firmId, name, phone, locale, role: "driver", email: null, passwordHash: "", sessionVersion: 0 };
    const i: InviteRow = { id: newId("i"), firmId, name, phone, locale, userId: u.id, usedAt: null, createdAt: new Date().toISOString() };
    this.U.push(u); this.I.push(i); return { ...i };
  }
  async acceptInvite(firmId: string, id: string, phone: string, passwordHash: string) {
    const i = this.I.find((x) => x.firmId === firmId && x.id === id);
    if (!i || i.usedAt || i.revokedAt || Date.parse(i.createdAt) <= Date.now() - 14 * 86400000 || (i.phone && i.phone !== phone)) return null;
    const existing = i.userId ? this.U.find((u) => u.id === i.userId && u.firmId === firmId) : null;
    if (i.userId && (!existing || existing.passwordHash || existing.disabledAt)) return null;
    if (this.U.some((u) => u.phone === phone && u.id !== existing?.id)) throw new Error("exists");
    const u: UserRow = existing ?? { id: newId("u"), firmId, role: "driver", name: i.name, phone, email: null, passwordHash, locale: i.locale };
    u.passwordHash = passwordHash; u.phone = phone; u.sessionVersion = (u.sessionVersion ?? 0) + 1;
    if (!existing) this.U.push(u);
    i.usedAt = new Date().toISOString(); i.userId = u.id;
    return { ...u };
  }
  async updateTrip(firmId: string, id: string, patch: { revenue?: number; tonnes?: number | null; planned?: boolean }) {
    const r = this.R.find((x) => x.firmId === firmId && x.id === id); if (!r) return false;
    Object.assign(r, patch); return true;
  }
  async useInvite(firmId: string, id: string, userId: string) { const r = this.I.find((x) => x.id === id && x.firmId === firmId && !x.usedAt && !x.revokedAt); if (!r) return false; r.usedAt = new Date().toISOString(); r.userId = userId; return true; }
  async addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">) { if (this.T.some((x) => x.firmId === firmId && x.plate === t.plate)) throw new Error("exists"); const r = { ...t, id: newId("t"), firmId }; this.T.push(r); return { ...r }; }
  async updateTruck(firmId: string, id: string, p: { plate: string; vin?: string | null; model: string | null; tankL: number | null; normalL100: number | null }) { if (this.T.some((x) => x.firmId === firmId && x.plate === p.plate && x.id !== id)) throw new Error("dup"); const t = this.T.find((x) => x.id === id && x.firmId === firmId); if (!t) return false; Object.assign(t, p); return true; }
  async setUserEmail(id: string, email: string) { if (this.U.some((x) => x.email === email && x.id !== id)) throw new Error("dup"); const u = this.U.find((x) => x.id === id); if (u) u.email = email; }
  async updateTruckEcon(firmId: string, id: string, p: { costs?: Record<string, number>; archived?: boolean }) { const t = this.T.find((x) => x.id === id && x.firmId === firmId); if (!t) return false; if (p.costs) { const month = nextCostMonth(); t.costHistory = [...(t.costHistory ?? []).filter((x) => x.month !== month), { month, costs: { ...p.costs } }]; } if (p.archived !== undefined) t.archivedAt = p.archived ? new Date().toISOString() : null; return true; }
  async trucks(firmId: string) { return this.T.filter((x) => x.firmId === firmId); }
  private ownDoc(firmId: string, d: Partial<NewDoc>) {
    if (d.truckId && !this.T.some((x) => x.id === d.truckId && x.firmId === firmId)) throw new Error("truck");
    if (d.userId && !this.U.some((x) => x.id === d.userId && x.firmId === firmId)) throw new Error("user");
  }
  async addDoc(firmId: string, d: NewDoc) { if (!d.truckId && !d.userId) throw new Error("truck"); this.ownDoc(firmId, d); const r: DocRow = { ...d, scope: d.userId ? "driver" : "vehicle", id: newId("d"), firmId }; this.D.push(r); return { ...r }; }
  async updateDoc(firmId: string, id: string, d: Partial<NewDoc>) { this.ownDoc(firmId, d); const r = this.D.find((x) => x.id === id && x.firmId === firmId); if (!r) return null; Object.assign(r, d); return { ...r }; }
  async deleteDoc(firmId: string, id: string) { const i = this.D.findIndex((x) => x.id === id && x.firmId === firmId); if (i < 0) return false; this.D.splice(i, 1); return true; }
  async setUserTruck(firmId: string, userId: string, truckId: string | null) {
    const u = this.U.find((x) => x.id === userId && x.firmId === firmId && x.role === "driver" && !x.disabledAt);
    if (!u || (truckId && !this.T.some((t) => t.id === truckId && t.firmId === firmId && !t.archivedAt))) throw new Error("assignment");
    if (truckId && this.U.some((x) => x.id !== userId && x.firmId === firmId && x.truckId === truckId && !x.disabledAt)) throw new Error("assignment");
    // No awaits before mutation: competing requests cannot both claim the same truck.
    const from = u.truckId ?? null;
    for (const id of [from, truckId]) { const sh = id ? this.H.get(`${firmId}:${id}`) : null; if (sh && !sh.end) throw new Error("assignment"); }
    u.truckId = truckId;
    if (truckId && from !== truckId) await this.addAssignment(firmId, { userId, truckId, fromTruckId: from });
  }
  async renewInvite(firmId: string, id: string) {
    const i = this.I.find((x) => x.firmId === firmId && x.id === id && !x.usedAt); if (!i) return false;
    i.createdAt = new Date().toISOString(); i.revokedAt = null; return true;
  }
  async revokeInvite(firmId: string, id: string) { const r = this.I.find((x) => x.id === id && x.firmId === firmId && !x.usedAt && !x.revokedAt); if (!r) return false; r.revokedAt = new Date().toISOString(); return true; }
  async setPod(firmId: string, tripId: string, received: boolean) { const r = this.R.find((x) => x.id === tripId && x.firmId === firmId); if (!r) return false; r.podReceived = received; return true; }
  private FL: (FileMeta & { data: Buffer | null })[] = []; private N: NotificationRow[] = []; private E: EmailRow[] = []; private V: TripEventRow[] = [];
  async addFile(firmId: string, f: NewFile) {
    if (f.tripId && !this.R.some((x) => x.id === f.tripId && x.firmId === firmId)) throw new Error("trip");
    if (f.docId && !this.D.some((x) => x.id === f.docId && x.firmId === firmId)) throw new Error("doc");
    const r = { ...f, id: newId("fl"), firmId, createdAt: new Date().toISOString() }; this.FL.push(r); const { data: _d, ...m } = r; return m;
  }
  async file(firmId: string, id: string) { const r = this.FL.find((x) => x.id === id && x.firmId === firmId); return r ? { ...r } : null; }
  async files(firmId: string, o: { tripId?: string; docId?: string }) { return this.FL.filter((x) => x.firmId === firmId && (!o.tripId || x.tripId === o.tripId) && (!o.docId || x.docId === o.docId)).map(({ data: _d, ...m }) => m); }
  async deleteFile(firmId: string, id: string) { const i = this.FL.findIndex((x) => x.id === id && x.firmId === firmId); if (i < 0) return false; this.FL.splice(i, 1); return true; }
  async addNotifications(firmId: string, n: NewNotification[]) {
    const out: NotificationRow[] = [];
    for (const x of n) { if (this.N.some((y) => y.firmId === firmId && y.key === x.key)) continue; const r = { ...x, id: newId("n"), firmId, readAt: null, createdAt: new Date().toISOString() }; this.N.push(r); out.push(r); }
    return out;
  }
  async notifications(firmId: string, userId: string | null, limit = 50) { return this.N.filter((x) => x.firmId === firmId && x.userId === userId).reverse().slice(0, limit); }
  async markRead(firmId: string, userId: string | null) { for (const x of this.N) if (x.firmId === firmId && x.userId === userId && !x.readAt) x.readAt = new Date().toISOString(); }
  async addEmail(e: Parameters<Store["addEmail"]>[0]) { if (this.E.some((x) => x.key === e.key)) return null; const r: EmailRow = { ...e, id: newId("e"), status: "queued", error: null, providerId: null, createdAt: new Date().toISOString(), sentAt: null }; this.E.push(r); return { ...r }; }
  async setEmailStatus(id: string, status: EmailStatus, error: string | null, providerId: string | null) { const r = this.E.find((x) => x.id === id); if (r) Object.assign(r, { status, error, providerId, sentAt: status === "sent" ? new Date().toISOString() : null }); }
  async emails(limit = 100) { return [...this.E].reverse().slice(0, limit); }
  private TA: { firmId: string; userId: string; truckId: string; fromTruckId: string | null; at: string }[] = [];
  async setTripTruck(firmId: string, tripId: string, truckId: string) { if (!this.own(firmId, truckId)) throw new Error("truck"); const r = this.R.find((x) => x.id === tripId && x.firmId === firmId); if (r) r.truckId = truckId; }
  async addAssignment(firmId: string, a: { userId: string; truckId: string; fromTruckId: string | null }) { if (!this.own(firmId, a.truckId)) throw new Error("truck"); this.TA.push({ ...a, firmId, at: new Date().toISOString() }); }
  async assignments(firmId: string, userId?: string) { return this.TA.filter((x) => x.firmId === firmId && (!userId || x.userId === userId)).map(({ firmId: _f, ...x }) => x).reverse(); }
  async addTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId">) { if (!this.R.some((x) => x.id === e.tripId && x.firmId === firmId)) throw new Error("trip"); const r = { ...e, id: newId("v"), firmId }; this.V.push(r); return { ...r }; }
  async tripEvents(firmId: string, tripId: string) { return this.V.filter((x) => x.firmId === firmId && x.tripId === tripId).sort((a, b) => a.at.localeCompare(b.at)); }
  async docs(firmId: string) { return this.D.filter((x) => x.firmId === firmId); }
  async addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">) { if (!this.T.some((x) => x.id === t.truckId && x.firmId === firmId)) throw new Error("truck"); const r = { ...t, id: newId("r"), firmId }; this.R.push(r); return { ...r }; }
  async trips(firmId: string) { return this.R.filter((x) => x.firmId === firmId).sort((a, b) => b.date.localeCompare(a.date)); }
  async addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">) { const r: SupportRow = { ...s, id: newId("s"), status: "new", createdAt: new Date().toISOString() }; this.S.push(r); return { ...r }; }
  async support() { return [...this.S].reverse(); }
  async addLead(l: NewLead) { const r: LeadRow = { ...l, id: newId("l"), status: "new", createdAt: new Date().toISOString() }; this.LD.push(r); return { ...r }; }
  async leads() { return [...this.LD].reverse(); }
  async leadsFromIp(ipHash: string, sinceIso: string) { return this.LD.filter((x) => x.ipHash === ipHash && x.createdAt >= sinceIso).length; }
  private C: (CardRow & { firmId: string })[] = []; private X: FuelTxRow[] = []; private M: ImportRow[] = []; private H = new Map<string, ShiftRow>(); private P: (PosRow & { firmId: string })[] = [];
  private own = (firmId: string, truckId: string | null) => truckId == null || this.T.some((x) => x.id === truckId && x.firmId === firmId);
  async fuelCards(firmId: string) { return this.C.filter((c) => c.firmId === firmId).map(({ card, truckId }) => ({ card, truckId })); }
  async setCard(firmId: string, card: string, truckId: string | null) {
    if (!this.own(firmId, truckId)) throw new Error("truck");
    const c = this.C.find((x) => x.firmId === firmId && x.card === card);
    if (c) c.truckId = truckId; else this.C.push({ firmId, card, truckId });
    let n = 0; for (const x of this.X) if (x.firmId === firmId && x.card === card) { x.truckId = truckId; n++; }
    return n;
  }
  async addFuel(firmId: string, rows: NewFuelTx[]) {
    let added = 0, dupes = 0;
    for (const r of rows) {
      if (!this.own(firmId, r.truckId)) throw new Error("truck");
      if (this.X.some((x) => x.firmId === firmId && x.hash === r.hash)) { dupes++; continue; }
      this.X.push({ ...r, id: newId("x"), firmId }); added++;
    }
    return { added, dupes };
  }
  async fuelByHash(firmId: string, hash: string) { const r = this.X.find((x) => x.firmId === firmId && x.hash === hash); return r ? { ...r } : null; }
  async fuel(firmId: string, o: { truckId?: string; source?: string; limit?: number } = {}) {
    return this.X.filter((x) => x.firmId === firmId && (!o.truckId || x.truckId === o.truckId) && (!o.source || x.source === o.source)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, o.limit ?? 5000);
  }
  async addImport(firmId: string, i: Omit<ImportRow, "id" | "firmId" | "createdAt"> & { id?: string }) { const r = { ...i, id: i.id ?? newId("m"), firmId, createdAt: new Date().toISOString() }; this.M.push(r); return r; }
  async imports(firmId: string) { return this.M.filter((m) => m.firmId === firmId).reverse(); }
  async setShift(firmId: string, s: ShiftRow) { if (!this.own(firmId, s.truckId)) throw new Error("truck"); const prev = this.H.get(`${firmId}:${s.truckId}`);
    if (prev && !((!prev.end && prev.start === s.start) || (prev.end && prev.start !== s.start && !s.end && s.start > prev.end))) throw new Error("shift-conflict");
    this.H.set(`${firmId}:${s.truckId}`, { ...s }); return s; }
  async shift(firmId: string, truckId: string) { return this.H.get(`${firmId}:${truckId}`) ?? null; }
  private MP = new Map<string, Record<string, number>>();
  private DE: (DriverEventRow & { firmId: string })[] = [];
  private AT = new Map<string, { fails: number; first: number; lock: number | null }>();
  private atGet(key: string) { const r = this.AT.get(key); if (!r) return null; if (Date.now() - r.first > 3600e3 && !(r.lock && r.lock > Date.now())) { this.AT.delete(key); return null; } return r; }
  async authFails(key: string) { const r = this.atGet(key); return { fails: r?.fails ?? 0, lockedUntil: r?.lock && r.lock > Date.now() ? new Date(r.lock).toISOString() : null }; }
  async authFail(key: string, lockAfter: number, lockMin: number) { const r = this.atGet(key) ?? { fails: 0, first: Date.now(), lock: null }; r.fails++; if (r.fails >= lockAfter) r.lock = Date.now() + lockMin * 60e3 * 2 ** Math.min(4, r.fails - lockAfter); this.AT.set(key, r); return this.authFails(key); }
  async authClear(key: string) { this.AT.delete(key); }
  async addDriverEvent(firmId: string, e: Omit<DriverEventRow, "id">) { if (!this.own(firmId, e.truckId)) throw new Error("truck"); this.DE.push({ ...e, id: newId("de"), firmId }); if (this.DE.length > 20000) this.DE.shift(); }
  async driverEvents(firmId: string, sinceIso: string) { return this.DE.filter((x) => x.firmId === firmId && x.at >= sinceIso).map(({ firmId: _f, ...x }) => x).sort((a, b) => b.at.localeCompare(a.at)); }
  async savedMapping(firmId: string, sig: string) { return this.MP.get(`${firmId}|${sig}`) ?? null; }
  async saveMapping(firmId: string, sig: string, m: Record<string, number>) { this.MP.set(`${firmId}|${sig}`, { ...m }); }
  async addPosition(firmId: string, p: PosRow) { if (!this.own(firmId, p.truckId)) throw new Error("truck"); this.P.push({ ...p, firmId }); if (this.P.length > 50000) this.P.shift(); }
  async positions(firmId: string, sinceAt = "") { return this.P.filter((p) => p.firmId === firmId && p.at >= sinceAt).map(({ firmId: _f, ...p }) => p); }
}
