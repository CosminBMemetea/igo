// Postgres (Neon în prod) prin Drizzle. Fiecare interogare de date e filtrată după firm_id.
import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { documents, firms, invites, supportRequests, trips, trucks, users } from "@/db/schema";
import { newId, today, type Currency, type DocRow, type DocType, type FirmRow, type InviteRow, type Store, type SupportRow, type TripRow, type TruckRow, type UserRow } from "./types";

const iso = (d: Date | string | null) => (d == null ? null : d instanceof Date ? d.toISOString() : d);
const firmOut = (f: typeof firms.$inferSelect): FirmRow => ({ ...f, currency: f.currency as Currency, createdAt: iso(f.createdAt)! });
const userOut = (u: typeof users.$inferSelect): UserRow => ({ id: u.id, firmId: u.firmId, role: u.role as UserRow["role"], name: u.name, email: u.email, phone: u.phone, passwordHash: u.passwordHash });
const invOut = (i: typeof invites.$inferSelect): InviteRow => ({ id: i.id, firmId: i.firmId, name: i.name, phone: i.phone, usedAt: iso(i.usedAt), userId: i.userId, createdAt: iso(i.createdAt)! });
const truckOut = ({ createdAt: _c, ...t }: typeof trucks.$inferSelect): TruckRow => t;
const docOut = ({ createdAt: _c, ...d }: typeof documents.$inferSelect): DocRow => ({ ...d, type: d.type as DocType });
const tripOut = ({ createdAt: _c, ...t }: typeof trips.$inferSelect): TripRow => t;

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
  async addDoc(firmId: string, d: Omit<DocRow, "id" | "firmId">) {
    // camionul trebuie să fie al aceleiași firme
    const [own] = await this.d.select({ id: trucks.id }).from(trucks).where(and(eq(trucks.id, d.truckId), eq(trucks.firmId, firmId)));
    if (!own) throw new Error("truck");
    const [r] = await this.d.insert(documents).values({ ...d, id: newId("d"), firmId }).returning(); return docOut(r);
  }
  async docs(firmId: string) { return (await this.d.select().from(documents).where(eq(documents.firmId, firmId)).orderBy(documents.expires)).map(docOut); }
  async addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">) {
    const [own] = await this.d.select({ id: trucks.id }).from(trucks).where(and(eq(trucks.id, t.truckId), eq(trucks.firmId, firmId)));
    if (!own) throw new Error("truck");
    const [r] = await this.d.insert(trips).values({ ...t, id: newId("r"), firmId }).returning(); return tripOut(r);
  }
  async trips(firmId: string) { return (await this.d.select().from(trips).where(eq(trips.firmId, firmId)).orderBy(desc(trips.date), desc(trips.createdAt))).map(tripOut); }
  async addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">) { const [r] = await this.d.insert(supportRequests).values({ ...s, id: newId("s") }).returning(); return { ...r, createdAt: iso(r.createdAt)! }; }
  async support() { return (await this.d.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(200)).map((r) => ({ ...r, createdAt: iso(r.createdAt)! })); }
}
