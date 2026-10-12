// Postgres (Neon în prod) prin Drizzle. Fiecare interogare de date e filtrată după firm_id.
import { and, count, desc, eq, gte, isNull, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { importMappings, documents, emailOutbox, files, firms, notifications, tripEvents, fuelCards, fuelImports, fuelTransactions, invites, positions, shifts, supportRequests, trips, trucks, users } from "@/db/schema";
import { newId, today, type CardRow, type FuelTxRow, type ImportRow, type NewFuelTx, type PosRow, type ShiftRow, type Currency, type DocRow, type DocType, type NewDoc, type FileMeta, type NewFile, type NotificationRow, type NewNotification, type EmailRow, type EmailStatus, type TripEventRow, type TripEventKind, type FirmRow, type InviteRow, type Store, type SupportRow, type TripRow, type TruckRow, type UserRow } from "./types";

const iso = (d: Date | string | null) => (d == null ? null : d instanceof Date ? d.toISOString() : d);
const firmOut = (f: typeof firms.$inferSelect): FirmRow => ({ ...f, currency: f.currency as Currency, createdAt: iso(f.createdAt)! });
const userOut = (u: typeof users.$inferSelect): UserRow => ({ id: u.id, firmId: u.firmId, role: u.role as UserRow["role"], name: u.name, email: u.email, phone: u.phone, passwordHash: u.passwordHash, truckId: u.truckId });
const invOut = (i: typeof invites.$inferSelect): InviteRow => ({ id: i.id, firmId: i.firmId, name: i.name, phone: i.phone, usedAt: iso(i.usedAt), userId: i.userId, createdAt: iso(i.createdAt)!, revokedAt: iso(i.revokedAt) });
const truckOut = ({ createdAt: _c, ...t }: typeof trucks.$inferSelect): TruckRow => t;
const docOut = ({ createdAt: _c, ...d }: typeof documents.$inferSelect): DocRow => ({ ...d, scope: d.scope === "driver" ? "driver" : "vehicle", type: d.type as DocType });
const fileOut = ({ data: _d, createdAt, ...f }: typeof files.$inferSelect): FileMeta => ({ ...f, kind: f.kind as FileMeta["kind"], storage: f.storage === "blob" ? "blob" : "db", createdAt: iso(createdAt)! });
const notOut = (n: typeof notifications.$inferSelect): NotificationRow => ({ ...n, params: JSON.parse(n.params), readAt: iso(n.readAt), createdAt: iso(n.createdAt)! });
const mailOut = (e: typeof emailOutbox.$inferSelect): EmailRow => ({ ...e, status: e.status as EmailStatus, createdAt: iso(e.createdAt)!, sentAt: iso(e.sentAt) });
const evOut = (e: typeof tripEvents.$inferSelect): TripEventRow => ({ ...e, kind: e.kind as TripEventKind, at: iso(e.at)! });
const tripOut = ({ createdAt: _c, litresSource: _l, ...t }: typeof trips.$inferSelect): TripRow => ({ ...t, litresSource: _l === "estimate" ? "estimate" : "manual" });
const txOut = ({ createdAt: _c, ...x }: typeof fuelTransactions.$inferSelect): FuelTxRow => x;

export class PgStore implements Store {
  readonly persistent = true;
  constructor(private d: Db) {}
  async createFirm(f: Pick<FirmRow, "name" | "cui">) { const [r] = await this.d.insert(firms).values({ id: newId("f"), name: f.name, cui: f.cui, trialStart: today() }).returning(); return firmOut(r); }
  async firm(id: string) { const [r] = await this.d.select().from(firms).where(eq(firms.id, id)); return r ? firmOut(r) : null; }
  async firms() {
    const all = await this.d.select().from(firms).orderBy(desc(firms.createdAt));
    const tc = await this.d.select({ f: trucks.firmId, n: count() }).from(trucks).groupBy(trucks.firmId);
    const uc = await this.d.select({ f: users.firmId, n: count() }).from(users).groupBy(users.firmId);
    return all.map((f) => ({ ...firmOut(f), trucks: tc.find((x) => x.f === f.id)?.n ?? 0, users: uc.find((x) => x.f === f.id)?.n ?? 0 }));
  }
  async updateFirm(id: string, p: Parameters<Store["updateFirm"]>[1]) { if (Object.keys(p).length) await this.d.update(firms).set(p).where(eq(firms.id, id)); }
  async createUser(u: Omit<UserRow, "id">) {
    try { const [r] = await this.d.insert(users).values({ ...u, id: newId("u") }).returning(); return userOut(r); }
    catch (e) { if (String((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === "23505") throw new Error("exists"); throw e; }
  }
  async userByLogin(login: string) { const [r] = await this.d.select().from(users).where(or(eq(users.email, login), eq(users.phone, login))).limit(1); return r ? userOut(r) : null; }
  async users(firmId: string) { return (await this.d.select().from(users).where(eq(users.firmId, firmId))).map(userOut); }
  async createInvite(firmId: string, name: string, phone: string | null) { const [r] = await this.d.insert(invites).values({ id: newId("i"), firmId, name, phone }).returning(); return invOut(r); }
  async invite(firmId: string, id: string) { const [r] = await this.d.select().from(invites).where(and(eq(invites.firmId, firmId), eq(invites.id, id))); return r ? invOut(r) : null; }
  async invites(firmId: string) { return (await this.d.select().from(invites).where(eq(invites.firmId, firmId)).orderBy(desc(invites.createdAt))).map(invOut); }
  async useInvite(firmId: string, id: string, userId: string) {
    const r = await this.d.update(invites).set({ usedAt: new Date(), userId }).where(and(eq(invites.firmId, firmId), eq(invites.id, id), isNull(invites.usedAt))).returning({ id: invites.id });
    return r.length === 1;
  }
  async addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">) {
    try { const [r] = await this.d.insert(trucks).values({ ...t, id: newId("t"), firmId }).returning(); return truckOut(r); }
    catch (e) { if (String((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === "23505") throw new Error("exists"); throw e; }
  }
  async trucks(firmId: string) { return (await this.d.select().from(trucks).where(eq(trucks.firmId, firmId)).orderBy(trucks.createdAt)).map(truckOut); }
  private async ownTarget(firmId: string, d: Partial<NewDoc>) {
    if (d.truckId) await this.ownTruck(firmId, d.truckId);
    if (d.userId) { const [u] = await this.d.select({ id: users.id }).from(users).where(and(eq(users.id, d.userId), eq(users.firmId, firmId))); if (!u) throw new Error("user"); }
  }
  async addDoc(firmId: string, d: NewDoc) {
    if (!d.truckId && !d.userId) throw new Error("truck");
    await this.ownTarget(firmId, d);
    const [r] = await this.d.insert(documents).values({ ...d, scope: d.userId ? "driver" : "vehicle", id: newId("d"), firmId }).returning(); return docOut(r);
  }
  async updateDoc(firmId: string, id: string, d: Partial<NewDoc>) {
    await this.ownTarget(firmId, d);
    const [r] = await this.d.update(documents).set(d).where(and(eq(documents.firmId, firmId), eq(documents.id, id))).returning();
    return r ? docOut(r) : null;
  }
  async deleteDoc(firmId: string, id: string) { return (await this.d.delete(documents).where(and(eq(documents.firmId, firmId), eq(documents.id, id))).returning({ id: documents.id })).length === 1; }
  async setUserTruck(firmId: string, userId: string, truckId: string | null) { await this.ownTruck(firmId, truckId); await this.d.update(users).set({ truckId }).where(and(eq(users.firmId, firmId), eq(users.id, userId))); }
  async revokeInvite(firmId: string, id: string) { return (await this.d.update(invites).set({ revokedAt: new Date() }).where(and(eq(invites.firmId, firmId), eq(invites.id, id), isNull(invites.usedAt))).returning({ id: invites.id })).length === 1; }
  async setPod(firmId: string, tripId: string, received: boolean) { return (await this.d.update(trips).set({ podReceived: received }).where(and(eq(trips.firmId, firmId), eq(trips.id, tripId))).returning({ id: trips.id })).length === 1; }
  private async ownTrip(firmId: string, tripId: string | null) {
    if (!tripId) return;
    const [t] = await this.d.select({ id: trips.id }).from(trips).where(and(eq(trips.firmId, firmId), eq(trips.id, tripId)));
    if (!t) throw new Error("trip");
  }
  async addFile(firmId: string, f: NewFile) {
    await this.ownTrip(firmId, f.tripId);
    if (f.docId) { const [d] = await this.d.select({ id: documents.id }).from(documents).where(and(eq(documents.firmId, firmId), eq(documents.id, f.docId))); if (!d) throw new Error("doc"); }
    const [r] = await this.d.insert(files).values({ ...f, id: newId("fl"), firmId }).returning();
    return fileOut(r);
  }
  async file(firmId: string, id: string) { const [r] = await this.d.select().from(files).where(and(eq(files.firmId, firmId), eq(files.id, id))); return r ? { ...fileOut(r), data: r.data ?? null } : null; }
  async files(firmId: string, o: { tripId?: string; docId?: string }) {
    const w = [eq(files.firmId, firmId)];
    if (o.tripId) w.push(eq(files.tripId, o.tripId));
    if (o.docId) w.push(eq(files.docId, o.docId));
    const r = await this.d.select({ id: files.id, firmId: files.firmId, kind: files.kind, tripId: files.tripId, docId: files.docId, name: files.name, mime: files.mime, size: files.size, storage: files.storage, url: files.url, userId: files.userId, createdAt: files.createdAt }).from(files).where(and(...w)).orderBy(files.createdAt);
    return r.map((f) => fileOut({ ...f, data: null }));
  }
  async deleteFile(firmId: string, id: string) { return (await this.d.delete(files).where(and(eq(files.firmId, firmId), eq(files.id, id))).returning({ id: files.id })).length === 1; }
  async addNotifications(firmId: string, n: NewNotification[]) {
    if (!n.length) return [];
    const r = await this.d.insert(notifications).values(n.map((x) => ({ ...x, params: JSON.stringify(x.params), id: newId("n"), firmId }))).onConflictDoNothing({ target: [notifications.firmId, notifications.key] }).returning();
    return r.map(notOut);
  }
  async notifications(firmId: string, userId: string | null, limit = 50) {
    return (await this.d.select().from(notifications).where(and(eq(notifications.firmId, firmId), userId ? eq(notifications.userId, userId) : isNull(notifications.userId))).orderBy(desc(notifications.createdAt)).limit(limit)).map(notOut);
  }
  async markRead(firmId: string, userId: string | null) { await this.d.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.firmId, firmId), userId ? eq(notifications.userId, userId) : isNull(notifications.userId), isNull(notifications.readAt))); }
  async addEmail(e: Parameters<Store["addEmail"]>[0]) {
    const [r] = await this.d.insert(emailOutbox).values({ ...e, id: newId("e"), status: "queued" }).onConflictDoNothing({ target: emailOutbox.key }).returning();
    return r ? mailOut(r) : null;
  }
  async setEmailStatus(id: string, status: EmailStatus, error: string | null, providerId: string | null) { await this.d.update(emailOutbox).set({ status, error, providerId, sentAt: status === "sent" ? new Date() : null }).where(eq(emailOutbox.id, id)); }
  async emails(limit = 100) { return (await this.d.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(limit)).map(mailOut); }
  async addTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId">) {
    await this.ownTrip(firmId, e.tripId);
    const [r] = await this.d.insert(tripEvents).values({ ...e, at: new Date(e.at), id: newId("v"), firmId }).returning(); return evOut(r);
  }
  async tripEvents(firmId: string, tripId: string) { return (await this.d.select().from(tripEvents).where(and(eq(tripEvents.firmId, firmId), eq(tripEvents.tripId, tripId))).orderBy(tripEvents.at)).map(evOut); }
  async docs(firmId: string) { return (await this.d.select().from(documents).where(eq(documents.firmId, firmId)).orderBy(documents.expires)).map(docOut); }
  async addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">) {
    const [own] = await this.d.select({ id: trucks.id }).from(trucks).where(and(eq(trucks.id, t.truckId), eq(trucks.firmId, firmId)));
    if (!own) throw new Error("truck");
    const [r] = await this.d.insert(trips).values({ ...t, id: newId("r"), firmId }).returning(); return tripOut(r);
  }
  async trips(firmId: string) { return (await this.d.select().from(trips).where(eq(trips.firmId, firmId)).orderBy(desc(trips.date), desc(trips.createdAt))).map(tripOut); }
  async addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">) { const [r] = await this.d.insert(supportRequests).values({ ...s, id: newId("s") }).returning(); return { ...r, createdAt: iso(r.createdAt)! }; }
  private async ownTruck(firmId: string, truckId: string | null) {
    if (truckId == null) return;
    const [own] = await this.d.select({ id: trucks.id }).from(trucks).where(and(eq(trucks.id, truckId), eq(trucks.firmId, firmId)));
    if (!own) throw new Error("truck");
  }
  async fuelCards(firmId: string): Promise<CardRow[]> { return this.d.select({ card: fuelCards.card, truckId: fuelCards.truckId }).from(fuelCards).where(eq(fuelCards.firmId, firmId)); }
  async setCard(firmId: string, card: string, truckId: string | null) {
    await this.ownTruck(firmId, truckId);
    await this.d.insert(fuelCards).values({ firmId, card, truckId }).onConflictDoUpdate({ target: [fuelCards.firmId, fuelCards.card], set: { truckId, updatedAt: new Date() } });
    const r = await this.d.update(fuelTransactions).set({ truckId }).where(and(eq(fuelTransactions.firmId, firmId), eq(fuelTransactions.card, card))).returning({ id: fuelTransactions.id });
    return r.length;
  }
  async addFuel(firmId: string, rows: NewFuelTx[]) {
    for (const id of new Set(rows.map((r) => r.truckId).filter((x): x is string => !!x))) await this.ownTruck(firmId, id);
    let added = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400).map((r) => ({ ...r, id: newId("x"), firmId }));
      const r = await this.d.insert(fuelTransactions).values(chunk).onConflictDoNothing({ target: [fuelTransactions.firmId, fuelTransactions.hash] }).returning({ id: fuelTransactions.id });
      added += r.length;
    }
    return { added, dupes: rows.length - added };
  }
  async fuel(firmId: string, o: { truckId?: string; source?: string; limit?: number } = {}) {
    const w = [eq(fuelTransactions.firmId, firmId)];
    if (o.truckId) w.push(eq(fuelTransactions.truckId, o.truckId));
    if (o.source) w.push(eq(fuelTransactions.source, o.source));
    return (await this.d.select().from(fuelTransactions).where(and(...w)).orderBy(desc(fuelTransactions.at)).limit(o.limit ?? 5000)).map(txOut);
  }
  async addImport(firmId: string, i: Omit<ImportRow, "id" | "firmId" | "createdAt"> & { id?: string }) { const [r] = await this.d.insert(fuelImports).values({ ...i, id: i.id ?? newId("m"), firmId }).returning(); return { ...r, createdAt: iso(r.createdAt)! }; }
  async imports(firmId: string) { return (await this.d.select().from(fuelImports).where(eq(fuelImports.firmId, firmId)).orderBy(desc(fuelImports.createdAt)).limit(50)).map((r) => ({ ...r, createdAt: iso(r.createdAt)! })); }
  async setShift(firmId: string, s: ShiftRow) {
    await this.ownTruck(firmId, s.truckId);
    const v = { start: s.start, end: s.end, checklist: JSON.stringify(s.checklist), privateSince: s.privateSince ?? null };
    await this.d.insert(shifts).values({ firmId, truckId: s.truckId, ...v }).onConflictDoUpdate({ target: [shifts.firmId, shifts.truckId], set: v });
    return s;
  }
  async shift(firmId: string, truckId: string) {
    const [r] = await this.d.select().from(shifts).where(and(eq(shifts.firmId, firmId), eq(shifts.truckId, truckId)));
    return r ? { truckId: r.truckId, start: r.start, end: r.end, checklist: JSON.parse(r.checklist) as string[], privateSince: r.privateSince } : null;
  }
  async savedMapping(firmId: string, sig: string) { const [r] = await this.d.select().from(importMappings).where(and(eq(importMappings.firmId, firmId), eq(importMappings.sig, sig))); return r ? (JSON.parse(r.mapping) as Record<string, number>) : null; }
  async saveMapping(firmId: string, sig: string, m: Record<string, number>) { const v = { mapping: JSON.stringify(m), updatedAt: new Date() }; await this.d.insert(importMappings).values({ firmId, sig, ...v }).onConflictDoUpdate({ target: [importMappings.firmId, importMappings.sig], set: v }); }
  async addPosition(firmId: string, p: PosRow) { await this.ownTruck(firmId, p.truckId); await this.d.insert(positions).values({ ...p, id: newId("p"), firmId }); }
  async positions(firmId: string, sinceAt = "") { return this.d.select({ truckId: positions.truckId, at: positions.at, lat: positions.lat, lng: positions.lng }).from(positions).where(and(eq(positions.firmId, firmId), gte(positions.at, sinceAt))).orderBy(positions.at).limit(20000); }
  async support() { return (await this.d.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(200)).map((r) => ({ ...r, createdAt: iso(r.createdAt)! })); }
}
