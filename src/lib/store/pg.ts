import { validCardId, validCardTime } from "../fuel/cards";
import { nextCostMonth } from "../costs";
// Postgres (Neon în prod) prin Drizzle. Fiecare interogare de date e filtrată după firm_id.
import { and, count, desc, eq, gt, gte, lt, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mobileSessionRevocations, notificationJobs, pushDevices, complianceTasks, truckAssignments, authThrottle, driverEvents, leads, importMappings, documents, emailOutbox, files, firms, notifications, tripEvents, fuelCards, fuelCardPeriods, fuelImports, fuelTransactions, invites, positions, shifts, supportRequests, trips, trucks, users } from "@/db/schema";
import { type DriverEventRow, newId, today, type LeadRow, type NewLead, type CardRow, type FuelTxRow, type ImportRow, type NewFuelTx, type PosRow, type ShiftRow, type Currency, type DocRow, type DocType, type NewDoc, type FileMeta, type NewFile, type NotificationRow, type NewNotification, type EmailRow, type EmailStatus, type TripEventRow, type TripEventKind, type FirmRow, type InviteRow, type Store, type SupportRow, type TripRow, type TruckRow, type UserRow } from "./types";

const iso = (d: Date | string | null) => (d == null ? null : d instanceof Date ? d.toISOString() : d);
const leadOut = (r: typeof leads.$inferSelect): LeadRow => ({ ...r, consentAt: iso(r.consentAt)!, createdAt: iso(r.createdAt)! });
const firmOut = (f: typeof firms.$inferSelect): FirmRow => ({ ...f, currency: f.currency as Currency, createdAt: iso(f.createdAt)! });
const userOut = (u: typeof users.$inferSelect): UserRow => ({ id: u.id, firmId: u.firmId, role: u.role as UserRow["role"], name: u.name, email: u.email, phone: u.phone, passwordHash: u.passwordHash, sessionVersion: u.sessionVersion, emailAlerts: u.emailAlerts, truckId: u.truckId, locale: u.locale, disabledAt: u.disabledAt ? u.disabledAt.toISOString() : null });
const invOut = (i: typeof invites.$inferSelect): InviteRow => ({ id: i.id, firmId: i.firmId, name: i.name, phone: i.phone, usedAt: iso(i.usedAt), userId: i.userId, createdAt: iso(i.createdAt)!, revokedAt: iso(i.revokedAt), locale: i.locale });
const truckOut = ({ createdAt: _c, archivedAt, ...t }: typeof trucks.$inferSelect): TruckRow => ({ ...t, archivedAt: iso(archivedAt) });
const docOut = ({ createdAt: _c, ...d }: typeof documents.$inferSelect): DocRow => ({ ...d, scope: d.scope === "driver" ? "driver" : "vehicle", type: d.type as DocType });
const fileOut = ({ data: _d, createdAt, ...f }: typeof files.$inferSelect): FileMeta => ({ ...f, kind: f.kind as FileMeta["kind"], storage: f.storage === "blob" ? "blob" : "db", createdAt: iso(createdAt)! });
const notOut = (n: typeof notifications.$inferSelect): NotificationRow => ({ ...n, params: JSON.parse(n.params), readAt: iso(n.readAt), createdAt: iso(n.createdAt)! });
const mailOut = (e: typeof emailOutbox.$inferSelect): EmailRow => ({ ...e, channel: e.channel as EmailRow["channel"], status: e.status as EmailStatus, createdAt: iso(e.createdAt)!, sentAt: iso(e.sentAt), nextAttemptAt: iso(e.nextAttemptAt)!, leaseUntil: iso(e.leaseUntil), firstAttemptAt: iso(e.firstAttemptAt), expiresAt: iso(e.expiresAt)! });
const evOut = (e: typeof tripEvents.$inferSelect): TripEventRow => ({ ...e, kind: e.kind as TripEventKind, at: iso(e.at)! });
const tripOut = ({ createdAt: _c, litresSource: _l, ...t }: typeof trips.$inferSelect): TripRow => ({ ...t, litresSource: _l === "estimate" ? "estimate" : "manual" });
const noDate = <T extends { at: Date }>(r: T) => ({ ...r, at: r.at.toISOString() });
const txOut = ({ createdAt: _c, ...x }: typeof fuelTransactions.$inferSelect): FuelTxRow => x;

export class PgStore implements Store {
  readonly persistent = true;
  constructor(private d: Db) {}
  async createFirm(f: Pick<FirmRow, "name" | "cui"> & { referredBy?: string | null }) { const [r] = await this.d.insert(firms).values({ id: newId("f"), name: f.name, cui: f.cui, trialStart: today(), referredBy: f.referredBy ?? null }).returning(); return firmOut(r); }
  async firm(id: string) { const [r] = await this.d.select().from(firms).where(eq(firms.id, id)); return r ? firmOut(r) : null; }
  async firms() {
    const all = await this.d.select().from(firms).orderBy(desc(firms.createdAt));
    const tc = await this.d.select({ f: trucks.firmId, n: count() }).from(trucks).groupBy(trucks.firmId);
    const uc = await this.d.select({ f: users.firmId, n: count() }).from(users).groupBy(users.firmId);
    return all.map((f) => ({ ...firmOut(f), trucks: tc.find((x) => x.f === f.id)?.n ?? 0, users: uc.find((x) => x.f === f.id)?.n ?? 0 }));
  }
  async updateFirm(id: string, p: Parameters<Store["updateFirm"]>[1]) { if (Object.keys(p).length) await this.d.update(firms).set(p).where(eq(firms.id, id)); }
  async createUser(u: Omit<UserRow, "id">) {
    try { const [r] = await this.d.insert(users).values({ ...u, disabledAt: null, id: newId("u") }).returning(); return userOut(r); }
    catch (e) { if (String((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === "23505") throw new Error("exists"); throw e; }
  }
  async userByLogin(login: string) { const [r] = await this.d.select().from(users).where(or(eq(users.email, login), eq(users.phone, login))).limit(1); return r ? userOut(r) : null; }
  async setUserPassword(id: string, passwordHash: string) { await this.d.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id)); }
  private firmTables() {
    return { pushDevices, complianceTasks, users, invites, trucks, documents, trips, supportRequests, fuelCards, fuelCardPeriods, fuelImports, fuelTransactions, shifts, positions, files, notifications, emailOutbox, tripEvents, importMappings, driverEvents, truckAssignments } as const;
  }
  async firmCounts(firmId: string) {
    const out: Record<string, number> = {};
    const [f] = await this.d.select({ n: count() }).from(firms).where(eq(firms.id, firmId)); out.firms = Number(f?.n ?? 0);
    for (const [k, tb] of Object.entries(this.firmTables())) { const [r] = await this.d.select({ n: count() }).from(tb).where(eq((tb as typeof users).firmId, firmId)); out[k] = Number(r?.n ?? 0); }
    return out;
  }
  async deleteFirm(firmId: string) {
    const counts = await this.firmCounts(firmId);
    const blobUrls = (await this.d.select({ url: files.url }).from(files).where(and(eq(files.firmId, firmId), eq(files.storage, "blob")))).map((r) => r.url).filter((u): u is string => !!u);
    // o singură tranzacție: întâi tabelele fără FK spre firms, apoi copiii, la final firma (restul cade în cascadă)
    const T = this.firmTables(), order = [T.pushDevices, T.complianceTasks, T.driverEvents, T.tripEvents, T.positions, T.shifts, T.notifications, T.files, T.fuelTransactions, T.fuelImports, T.fuelCardPeriods, T.fuelCards, T.importMappings, T.documents, T.trips, T.invites, T.users, T.trucks, T.supportRequests, T.emailOutbox, T.truckAssignments];
    const d = this.d as unknown as { batch?: (q: unknown[]) => Promise<unknown>; transaction?: (f: (tx: Db) => Promise<void>) => Promise<void> };
    const build = (db: Db) => [...order.map((tb) => db.delete(tb).where(eq((tb as typeof users).firmId, firmId))), db.delete(firms).where(eq(firms.id, firmId))];
    if (typeof d.batch === "function") await d.batch(build(this.d));
    else await d.transaction!(async (tx) => { for (const q of build(tx)) await q; });
    return { counts, blobUrls };
  }
  async userById(id: string) { const [r] = await this.d.select().from(users).where(eq(users.id, id)).limit(1); return r ? userOut(r) : null; }
  async setUserDisabled(firmId: string, userId: string, off: boolean) {
    const result = await this.d.execute(sql`with old_user as (
      select id, truck_id from users where id = ${userId} and firm_id = ${firmId} and role = 'driver' for update
    ), ended as (
      update shifts set "end" = now()::text, private_since = null where firm_id = ${firmId} and truck_id in (select truck_id from old_user) and "end" is null and ${off}
    ) update users set disabled_at = case when ${off} then now() else null end,
      truck_id = case when ${off} then null else truck_id end, session_version = session_version + 1
      where id in (select id from old_user) returning id`);
    return result.rows.length === 1;
  }
  async users(firmId: string) { return (await this.d.select().from(users).where(eq(users.firmId, firmId))).map(userOut); }
  async setUserLocale(id: string, locale: string) { await this.d.update(users).set({ locale }).where(eq(users.id, id)); }
  async createInvite(firmId: string, name: string, phone: string | null, locale: string | null = null) { const [r] = await this.d.insert(invites).values({ id: newId("i"), firmId, name, phone, locale }).returning(); return invOut(r); }
  async invite(firmId: string, id: string) { const [r] = await this.d.select().from(invites).where(and(eq(invites.firmId, firmId), eq(invites.id, id))); return r ? invOut(r) : null; }
  async invites(firmId: string) { return (await this.d.select().from(invites).where(eq(invites.firmId, firmId)).orderBy(desc(invites.createdAt))).map(invOut); }
  async createDriverInvite(firmId: string, name: string, phone: string, locale: string) {
    const uid = newId("u"), iid = newId("i");
    await this.d.execute(sql`with person as (
      insert into users (id, firm_id, role, name, phone, password_hash, locale)
      values (${uid}, ${firmId}, 'driver', ${name}, ${phone}, '', ${locale}) returning id
    ) insert into invites (id, firm_id, name, phone, locale, user_id)
      select ${iid}, ${firmId}, ${name}, ${phone}, ${locale}, id from person`);
    return (await this.invite(firmId, iid))!;
  }
  async acceptInvite(firmId: string, id: string, phone: string, passwordHash: string) {
    // Claim and activate/insert are a single PostgreSQL statement, also supported by Neon HTTP.
    const uid = newId("u");
    const result = await this.d.execute(sql`with claimed as (
      update invites set used_at = now(), user_id = coalesce(user_id, ${uid})
      where id = ${id} and firm_id = ${firmId} and used_at is null and revoked_at is null
        and created_at > now() - interval '14 days' and (phone is null or phone = ${phone})
        and (user_id is null or exists (select 1 from users u where u.id = invites.user_id and u.firm_id = invites.firm_id and u.password_hash = '' and u.disabled_at is null))
      returning *
    ), activated as (
      update users u set password_hash = ${passwordHash}, phone = ${phone}, session_version = u.session_version + 1
      from claimed c where u.id = c.user_id and u.firm_id = c.firm_id and u.role = 'driver'
        and u.password_hash = '' and u.disabled_at is null returning u.id
    ), created as (
      insert into users (id, firm_id, role, name, phone, password_hash, locale)
      select user_id, firm_id, 'driver', name, ${phone}, ${passwordHash}, locale from claimed where user_id = ${uid}
      returning id
    ) select id from activated union all select id from created`);
    const rows = result.rows as { id: string }[];
    return rows[0] ? this.userById(rows[0].id) : null;
  }
  async cancelTrip(firmId: string, id: string, reason: string) {
    if (!reason.trim()) return false;
    const rows = await this.d.update(trips).set({ cancelledAt: new Date().toISOString(), cancelReason: reason }).where(and(eq(trips.firmId, firmId), eq(trips.id, id), eq(trips.planned, true), isNull(trips.loadedAt), isNull(trips.cancelledAt))).returning({ id: trips.id }); return rows.length === 1;
  }
  async completeTrip(firmId: string, id: string) {
    const rows = await this.d.update(trips).set({ planned: false }).where(and(eq(trips.firmId, firmId), eq(trips.id, id), eq(trips.planned, true), isNull(trips.cancelledAt), sql`${trips.deliveredAt} is not null`)).returning({ id: trips.id }); return rows.length === 1;
  }
  async recordTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId"> & { requestKey: string; expectedShiftStart?: string; expectedTruckId?: string }) {
    const id = newId("v");
    try {
      await this.d.execute(sql`with shift_guard as materialized (
        select * from shifts where firm_id = ${firmId} and truck_id = ${e.expectedTruckId ?? ""} for update
      ), changed as (
        update trips set
          loaded_at = case when ${e.kind} = 'loaded' then ${e.at} else loaded_at end,
          delivered_at = case when ${e.kind} = 'unloaded' then ${e.at} else delivered_at end,
          wait_since = case when ${e.kind} = 'wait_start' then ${e.at} when ${e.kind} = 'wait_end' then null else wait_since end,
          last_event_at = ${e.at}
        where id = ${e.tripId} and firm_id = ${firmId} and planned = true and cancelled_at is null and delivered_at is null
          and (last_event_at is null or last_event_at <= ${e.at})
          ${e.expectedShiftStart ? sql`and truck_id = ${e.expectedTruckId} and driver_id = ${e.userId}
            and exists (select 1 from users u where u.id = ${e.userId} and u.firm_id = ${firmId} and u.truck_id = trips.truck_id and u.disabled_at is null)
            and exists (select 1 from shift_guard sh where sh.start = ${e.expectedShiftStart}
              and sh.start::timestamptz <= ${e.at}::timestamptz
              and (sh."end" is null or sh."end"::timestamptz >= ${e.at}::timestamptz)
              and (sh.private_since is null or sh.private_since::timestamptz > ${e.at}::timestamptz))` : sql``}
          and not exists (select 1 from trip_events where firm_id = ${firmId} and request_key = ${e.requestKey})
          and ((${e.kind} = 'loaded' and loaded_at is null and wait_since is null)
            or (${e.kind} = 'unloaded' and loaded_at is not null and wait_since is null)
            or (${e.kind} = 'wait_start' and wait_since is null)
            or (${e.kind} = 'wait_end' and wait_since is not null)) returning id, truck_id, title
      ), inserted as (insert into trip_events (id, firm_id, trip_id, kind, at, lat, lng, user_id, request_key)
        select ${id}, ${firmId}, id, ${e.kind}, ${e.at}::timestamptz, ${e.lat}, ${e.lng}, ${e.userId}, ${e.requestKey} from changed returning id
      ) insert into driver_events (id, firm_id, truck_id, user_id, kind, at, lat, lng, note)
        select inserted.id, ${firmId}, changed.truck_id, ${e.userId}, ${e.kind}, ${e.at}::timestamptz, ${e.lat}, ${e.lng}, changed.title
        from inserted cross join changed`);
    } catch (err) {
      const x = err as { code?: string; cause?: { code?: string } }; if (x.code !== "23505" && x.cause?.code !== "23505") throw err;
    }
    const [row] = await this.d.select().from(tripEvents).where(and(eq(tripEvents.firmId, firmId), eq(tripEvents.requestKey, e.requestKey)));
    if (!row || row.tripId !== e.tripId || row.kind !== e.kind || row.userId !== e.userId) throw new Error("transition");
    return { event: evOut(row), duplicate: row.id !== id };
  }
  async editPlannedTrip(firmId: string, id: string, patch: Omit<TripRow, "id" | "firmId">) {
    const rows = await this.d.update(trips).set(patch).where(and(eq(trips.firmId, firmId), eq(trips.id, id), eq(trips.planned, true), isNull(trips.loadedAt), isNull(trips.cancelledAt), sql`exists (select 1 from trucks where id = ${patch.truckId} and firm_id = ${firmId})`)).returning({ id: trips.id });
    return rows.length === 1;
  }
  async updateTrip(firmId: string, id: string, patch: { revenue?: number; tonnes?: number | null; planned?: boolean }) {
    const rows = await this.d.update(trips).set(patch).where(and(eq(trips.firmId, firmId), eq(trips.id, id))).returning({ id: trips.id });
    return rows.length === 1;
  }
  async useInvite(firmId: string, id: string, userId: string) {
    const r = await this.d.update(invites).set({ usedAt: new Date(), userId }).where(and(eq(invites.firmId, firmId), eq(invites.id, id), isNull(invites.usedAt), isNull(invites.revokedAt))).returning({ id: invites.id });
    return r.length === 1;
  }
  async complianceTasks(firmId: string) { return (await this.d.select().from(complianceTasks).where(eq(complianceTasks.firmId, firmId)).orderBy(desc(complianceTasks.createdAt))).map(t => ({...t, createdAt:iso(t.createdAt)!, updatedAt:iso(t.updatedAt)!})); }
  async addComplianceTask(firmId: string, task: Pick<import("./types").ComplianceTaskRow, "truckId" | "driverId" | "type" | "due">) {
    const result = await this.d.execute(sql`insert into compliance_tasks(id,firm_id,truck_id,driver_id,type,due)
      select ${newId("ct")}, ${firmId}, t.id, u.id, ${task.type}, ${task.due}::date from trucks t join users u on u.truck_id=t.id and u.firm_id=t.firm_id
      where t.id=${task.truckId} and t.firm_id=${firmId} and t.archived_at is null and u.id=${task.driverId} and u.role='driver' and u.disabled_at is null
      on conflict (firm_id,truck_id,type) where status in ('open','acknowledged') do update set id=compliance_tasks.id returning id`);
    const id = result.rows[0]?.id;
    return id ? (await this.complianceTasks(firmId)).find(t => t.id === id) ?? null : null;
  }
  async updateComplianceTask(firmId: string, id: string, status: "acknowledged" | "done" | "cancelled", driverId?: string) {
    if (driverId && status !== "acknowledged") return false;
    const result = await this.d.execute(sql`update compliance_tasks ct set status=${status}, updated_at=now()
      where ct.firm_id=${firmId} and ct.id=${id} and ct.status in ('open','acknowledged')
      and (${driverId ?? null}::text is null or (ct.driver_id=${driverId ?? null} and exists (
        select 1 from users u join trucks t on t.id=u.truck_id and t.firm_id=u.firm_id
        where u.id=ct.driver_id and u.firm_id=ct.firm_id and u.disabled_at is null and u.truck_id=ct.truck_id and t.archived_at is null
      ))) returning ct.id`); return result.rows.length === 1;
  }
  async updateComplianceBatch(firmId: string, changes: import("../compliance-csv").ComplianceUpdate[]) {
    if (!changes.length || new Set(changes.map(c => c.id)).size !== changes.length) return false;
    // One statement works on both Neon HTTP and node-postgres. Lock and validate
    // the complete preview before changing anything (no partially imported fleet).
    const result = await this.d.execute(sql`with input as (
      select * from jsonb_to_recordset(${JSON.stringify(changes)}::jsonb) as i(id text, plate text, previous jsonb, next jsonb)
    ), locked as materialized (
      select t.id, t.plate, t.compliance, t.archived_at from trucks t join input i on i.id = t.id
      where t.firm_id = ${firmId} order by t.id for update of t
    ), eligible as (
      select l.id from locked l join input i on i.id = l.id where l.archived_at is null and l.plate = i.plate
      and l.compliance is not distinct from nullif(i.previous, 'null'::jsonb)
    ) update trucks t set compliance = i.next from input i where t.id = i.id and t.firm_id = ${firmId}
      and (select count(*) from eligible) = ${changes.length} returning t.id`);
    return result.rows.length === changes.length;
  }
  async addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">) {
    try { const [r] = await this.d.insert(trucks).values({ ...t, costHistory: t.costHistory ?? [], archivedAt: null, id: newId("t"), firmId }).returning(); return truckOut(r); }
    catch (e) { if (String((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === "23505") throw new Error("exists"); throw e; }
  }
  async updateTruck(firmId: string, id: string, p: { plate: string; vin?: string | null; model: string | null; tankL: number | null; normalL100: number | null; compliance?: import("../compliance").VehicleCompliance | null }) { const r = await this.d.update(trucks).set(p).where(and(eq(trucks.firmId, firmId), eq(trucks.id, id))).returning({ id: trucks.id }); return r.length > 0; }
  async setUserEmail(id: string, email: string) { await this.d.update(users).set({ email }).where(eq(users.id, id)); }
  async updateTruckEcon(firmId: string, id: string, p: { costs?: Record<string, number>; archived?: boolean }) {
    const set: Partial<typeof trucks.$inferInsert> = {};
    if (p.costs) {
      const month = nextCostMonth();
      // One row update serializes concurrent edits; the legacy profile stays the baseline.
      const result = await this.d.update(trucks).set({ costHistory: sql`(
        select coalesce(jsonb_agg(item), '[]'::jsonb) from jsonb_array_elements(${trucks.costHistory}) item where item->>'month' <> ${month}
      ) || ${JSON.stringify([{ month, costs: p.costs }])}::jsonb` }).where(and(eq(trucks.id, id), eq(trucks.firmId, firmId))).returning({ id: trucks.id });
      if (p.archived === undefined || !result.length) return result.length > 0;
    }
    if (p.archived !== undefined) set.archivedAt = p.archived ? new Date() : null;
    const r = await this.d.update(trucks).set(set).where(and(eq(trucks.id, id), eq(trucks.firmId, firmId))).returning({ id: trucks.id });
    return r.length > 0;
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
  async setUserTruck(firmId: string, userId: string, truckId: string | null) {
    const result = await this.d.execute(sql`with candidate as (
      select u.id, u.truck_id from users u where u.id = ${userId} and u.firm_id = ${firmId} and u.role = 'driver' and u.disabled_at is null
      and (${truckId}::text is null or exists (select 1 from trucks t where t.id = ${truckId} and t.firm_id = ${firmId} and t.archived_at is null))
      and not exists (select 1 from shifts sh where sh.firm_id = ${firmId} and (sh.truck_id = u.truck_id or sh.truck_id = ${truckId}) and sh."end" is null)
      for update
    ), changed as (
      update users u set truck_id = ${truckId} from candidate c where u.id = c.id returning u.id, c.truck_id as old_truck
    ), history as (
      insert into truck_assignments (id, firm_id, user_id, truck_id, from_truck_id)
      select ${newId("ta")}, ${firmId}, id, ${truckId}, old_truck from changed where ${truckId}::text is not null and old_truck is distinct from ${truckId}
    ) select id from changed`);
    if (!result.rows.length) throw new Error("assignment");
  }
  async renewInvite(firmId: string, id: string) {
    // Advance atomically past the old token's whole-second timestamp, including concurrent renewals.
    const r = await this.d.update(invites).set({ createdAt: sql`greatest(now(), date_trunc('second', ${invites.createdAt}) + interval '1 second')`, revokedAt: null }).where(and(eq(invites.firmId, firmId), eq(invites.id, id), isNull(invites.usedAt))).returning({ id: invites.id });
    return r.length === 1;
  }
  async revokeInvite(firmId: string, id: string) { return (await this.d.update(invites).set({ revokedAt: new Date() }).where(and(eq(invites.firmId, firmId), eq(invites.id, id), isNull(invites.usedAt), isNull(invites.revokedAt))).returning({ id: invites.id })).length === 1; }
  async setPod(firmId: string, tripId: string, received: boolean) { return (await this.d.update(trips).set({ podReceived: received }).where(and(eq(trips.firmId, firmId), eq(trips.id, tripId))).returning({ id: trips.id })).length === 1; }
  private async ownTrip(firmId: string, tripId: string | null) {
    if (!tripId) return;
    const [t] = await this.d.select({ id: trips.id }).from(trips).where(and(eq(trips.firmId, firmId), eq(trips.id, tripId)));
    if (!t) throw new Error("trip");
  }
  async addFile(firmId: string, f: NewFile) {
    await this.ownTrip(firmId, f.tripId);
    if (f.docId) { const [d] = await this.d.select({ id: documents.id }).from(documents).where(and(eq(documents.firmId, firmId), eq(documents.id, f.docId))); if (!d) throw new Error("doc"); }
    const id = f.id ?? newId("fl");
    const [r] = await this.d.insert(files).values({ ...f, id, firmId }).onConflictDoUpdate({ target: files.id, set: { id }, setWhere: eq(files.firmId, firmId) }).returning();
    if (!r) throw new Error("trip");
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
    const [r] = await this.d.insert(emailOutbox).values({ ...e, expiresAt: e.expiresAt ? new Date(e.expiresAt) : undefined, id: newId("e"), status: "queued", nextAttemptAt: new Date() }).onConflictDoNothing({ target: emailOutbox.key }).returning();
    return r ? mailOut(r) : null;
  }
  async startNotificationJob(name: string, runId: string, at: string) {
    const value = { name, runId, startedAt: new Date(at), finishedAt: null, error: null, summary: null };
    await this.d.insert(notificationJobs).values(value).onConflictDoUpdate({ target: notificationJobs.name, set: value });
  }
  async finishNotificationJob(name: string, runId: string, summary: Record<string, number> | null, error: string | null) { await this.d.update(notificationJobs).set({ finishedAt: new Date(), summary, error }).where(and(eq(notificationJobs.name, name), eq(notificationJobs.runId, runId))); }
  async notificationJobs() { return (await this.d.select().from(notificationJobs)).map(r => ({ ...r, startedAt: r.startedAt.toISOString(), finishedAt: iso(r.finishedAt) })); }
  async claimDelivery(channels: ("email" | "push")[], now: string, id?: string) {
    if (!channels.length) return null;
    const token = newId("lease"), at = new Date(now), until = new Date(at.getTime() + 90_000);
    // Atomic claim, including leases abandoned by a terminated serverless invocation.
    const result = await this.d.execute(sql`with candidate as (
      select id from email_outbox where channel in (${sql.join(channels.map(c => sql`${c}`), sql`, `)})
      and ((status = 'queued' and next_attempt_at <= ${at}) or (status = 'processing' and lease_until <= ${at}))
      ${id ? sql`and id = ${id}` : sql``}
      order by next_attempt_at, created_at, id for update skip locked limit 1
    ) update email_outbox e set status = 'processing', attempts = e.attempts + 1,
      lease_token = ${token}, lease_until = ${until}, first_attempt_at = coalesce(e.first_attempt_at, ${at})
      from candidate c where e.id = c.id returning e.id`);
    const rows = (result as unknown as { rows?: { id: string }[] }).rows ?? result as unknown as { id: string }[];
    if (!rows.length) return null;
    const [r] = await this.d.select().from(emailOutbox).where(and(eq(emailOutbox.id, rows[0].id), eq(emailOutbox.leaseToken, token)));
    return r ? mailOut(r) : null;
  }
  async finishDelivery(id: string, token: string, p: import("./types").DeliveryFinish) {
    return (await this.d.update(emailOutbox).set({ status: p.status, error: p.error, providerId: p.providerId ?? null,
      nextAttemptAt: p.nextAttemptAt ? new Date(p.nextAttemptAt) : undefined, leaseToken: null, leaseUntil: null,
      sentAt: p.status === "sent" ? new Date() : null,
    }).where(and(eq(emailOutbox.id, id), eq(emailOutbox.leaseToken, token), eq(emailOutbox.status, "processing"))).returning({ id: emailOutbox.id })).length === 1;
  }
  async savePushDevice(d: Omit<import("./types").PushDevice, "id" | "createdAt">) {
    const u = await this.userById(d.userId);
    if (!u || u.firmId !== d.firmId || u.disabledAt || (u.sessionVersion ?? 0) !== d.sessionVersion) throw new Error("recipient");
    // New identity when a browser is rebound, so queued messages for its previous account cannot follow it.
    const value = { ...d, validUntil: d.validUntil ? new Date(d.validUntil) : null, id: newId("push"), createdAt: new Date() };
    const [r] = await this.d.insert(pushDevices).values(value).onConflictDoUpdate({ target: pushDevices.endpoint, set: value }).returning();
    return { ...r, validUntil: iso(r.validUntil), createdAt: r.createdAt.toISOString() };
  }
  async pushDevices(firmId: string, userId: string) { return (await this.d.select().from(pushDevices).where(and(eq(pushDevices.firmId, firmId), eq(pushDevices.userId, userId)))).map(r => ({ ...r, validUntil: iso(r.validUntil), createdAt: r.createdAt.toISOString() })); }
  async removePushDevice(firmId: string, userId: string, id?: string, binding?: string) {
    await this.d.delete(pushDevices).where(and(eq(pushDevices.firmId, firmId), eq(pushDevices.userId, userId), id ? eq(pushDevices.id, id) : undefined, binding ? eq(pushDevices.binding, binding) : undefined));
  }
  async revokeMobileSession(id: string, expiresAt: string) {
    await this.d.insert(mobileSessionRevocations).values({ id, expiresAt: new Date(expiresAt) }).onConflictDoNothing();
    await this.d.delete(mobileSessionRevocations).where(lt(mobileSessionRevocations.expiresAt, new Date()));
  }
  async mobileSessionRevoked(id: string) {
    return (await this.d.select({ id: mobileSessionRevocations.id }).from(mobileSessionRevocations).where(and(eq(mobileSessionRevocations.id, id), gte(mobileSessionRevocations.expiresAt, new Date())))).length > 0;
  }
  async revokePushBinding(binding: string) { await this.d.delete(pushDevices).where(eq(pushDevices.binding, binding)); }
  async setEmailAlerts(firmId: string, userId: string, enabled: boolean) { await this.d.update(users).set({ emailAlerts: enabled }).where(and(eq(users.firmId, firmId), eq(users.id, userId))); }
  async setEmailStatus(id: string, status: EmailStatus, error: string | null, providerId: string | null) { await this.d.update(emailOutbox).set({ status, error, providerId, sentAt: status === "sent" ? new Date() : null }).where(eq(emailOutbox.id, id)); }
  async emails(limit = 100) { return (await this.d.select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(limit)).map(mailOut); }
  async setTripTruck(firmId: string, tripId: string, truckId: string) { await this.ownTruck(firmId, truckId); await this.d.update(trips).set({ truckId }).where(and(eq(trips.firmId, firmId), eq(trips.id, tripId))); }
  async addAssignment(firmId: string, a: { userId: string; truckId: string; fromTruckId: string | null }) { await this.ownTruck(firmId, a.truckId); await this.d.insert(truckAssignments).values({ ...a, id: newId("ta"), firmId }); }
  async assignments(firmId: string, userId?: string) {
    const rs = await this.d.select({ userId: truckAssignments.userId, truckId: truckAssignments.truckId, fromTruckId: truckAssignments.fromTruckId, at: truckAssignments.at }).from(truckAssignments).where(userId ? and(eq(truckAssignments.firmId, firmId), eq(truckAssignments.userId, userId)) : eq(truckAssignments.firmId, firmId)).orderBy(desc(truckAssignments.at)).limit(200);
    return rs.map(noDate);
  }
  async addTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId">) {
    await this.ownTrip(firmId, e.tripId);
    const [r] = await this.d.insert(tripEvents).values({ ...e, at: new Date(e.at), id: newId("v"), firmId }).returning(); return evOut(r);
  }
  async tripEvents(firmId: string, tripId: string) { return (await this.d.select().from(tripEvents).where(and(eq(tripEvents.firmId, firmId), eq(tripEvents.tripId, tripId))).orderBy(tripEvents.at)).map(evOut); }
  async docs(firmId: string) { return (await this.d.select().from(documents).where(eq(documents.firmId, firmId)).orderBy(documents.expires)).map(docOut); }
  async addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">) {
    const [own] = await this.d.select({ id: trucks.id }).from(trucks).where(and(eq(trucks.id, t.truckId), eq(trucks.firmId, firmId)));
    if (!own) throw new Error("truck");
    const [r] = await this.d.insert(trips).values({ ...t, id: newId("r"), firmId }).onConflictDoNothing({ target: [trips.firmId, trips.requestKey] }).returning();
    if (r) return tripOut(r);
    const [existing] = t.requestKey ? await this.d.select().from(trips).where(and(eq(trips.firmId, firmId), eq(trips.requestKey, t.requestKey))) : [];
    if (!existing || !t.requestHash || existing.requestHash !== t.requestHash) throw new Error("request_conflict");
    return tripOut(existing);
  }
  async trips(firmId: string) { return (await this.d.select().from(trips).where(eq(trips.firmId, firmId)).orderBy(desc(trips.date), desc(trips.createdAt))).map(tripOut); }
  async addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">) { const [r] = await this.d.insert(supportRequests).values({ ...s, id: newId("s") }).returning(); return { ...r, createdAt: iso(r.createdAt)! }; }
  private async ownTruck(firmId: string, truckId: string | null) {
    if (truckId == null) return;
    const [own] = await this.d.select({ id: trucks.id }).from(trucks).where(and(eq(trucks.id, truckId), eq(trucks.firmId, firmId)));
    if (!own) throw new Error("truck");
  }
  async fuelCards(firmId: string): Promise<CardRow[]> { return this.d.select({ card: fuelCardPeriods.card, truckId: fuelCardPeriods.truckId, validFrom: fuelCardPeriods.validFrom }).from(fuelCardPeriods).where(eq(fuelCardPeriods.firmId, firmId)).orderBy(fuelCardPeriods.card, fuelCardPeriods.validFrom); }
  async setCard(firmId: string, card: string, truckId: string, validFrom: string) {
    if (!validCardId(card) || !validCardTime(validFrom)) throw new Error("card-input");
    const r = await this.d.execute(sql`select qf_set_fuel_card(${firmId}, ${card}, ${truckId}, ${validFrom}) as changed`);
    return Number(r.rows[0].changed);
  }
  async addFuel(firmId: string, rows: NewFuelTx[]) {
    if (!rows.length) return { added: 0, dupes: 0 };
    for (const id of new Set(rows.map((r) => r.truckId).filter((x): x is string => !!x))) await this.ownTruck(firmId, id);
    // One transaction on both Neon HTTP and node-postgres; a late conflict cannot leave a partial import.
    const build = (db: Db) => Array.from({ length: Math.ceil(rows.length / 400) }, (_, i) => db.insert(fuelTransactions).values(rows.slice(i * 400, (i + 1) * 400).map((r) => ({ ...r, id: newId("x"), firmId }))).onConflictDoNothing({ target: [fuelTransactions.firmId, fuelTransactions.hash] }).returning({ id: fuelTransactions.id }));
    const d = this.d as unknown as { batch?: (q: unknown[]) => Promise<{ id: string }[][]> };
    const results = d.batch ? await d.batch(build(this.d)) : await this.d.transaction(async (tx) => { const result = []; for (const q of build(tx as unknown as Db)) result.push(await q); return result; });
    const added = results.reduce((n, r) => n + r.length, 0);
    return { added, dupes: rows.length - added };
  }
  async fuelByHash(firmId: string, hash: string) { const [r] = await this.d.select().from(fuelTransactions).where(and(eq(fuelTransactions.firmId, firmId), eq(fuelTransactions.hash, hash))).limit(1); return r ? txOut(r) : null; }
  async updateDriverFuel(firmId: string, id: string, p: { litres: number; amount: number | null; odometer: number | null; station: string }) {
    const w = and(eq(fuelTransactions.firmId, firmId), eq(fuelTransactions.id, id), eq(fuelTransactions.source, "driver"));
    const [old] = await this.d.select().from(fuelTransactions).where(w).limit(1); if (!old) return null;
    const amountRon = p.amount != null && old.fxRate ? Math.round(p.amount * old.fxRate * 100) / 100 : null;
    const [r] = await this.d.update(fuelTransactions).set({ litres: p.litres, amount: p.amount, amountRon: old.fxRate ? amountRon : old.amountRon == null ? null : p.amount, odometer: p.odometer, station: p.station }).where(w).returning();
    return r ? txOut(r) : null;
  }
  async deleteTrip(firmId: string, id: string) {
    await this.d.delete(tripEvents).where(and(eq(tripEvents.firmId, firmId), eq(tripEvents.tripId, id)));
    return (await this.d.delete(trips).where(and(eq(trips.firmId, firmId), eq(trips.id, id))).returning({ id: trips.id })).length === 1;
  }
  async deleteImportedFuel(firmId: string, o: { id?: string; importId?: string }) {
    if (!o.id && !o.importId) return 0;
    const w = [eq(fuelTransactions.firmId, firmId), sql`${fuelTransactions.source} <> 'driver'`, o.id ? eq(fuelTransactions.id, o.id) : eq(fuelTransactions.importId, o.importId!)];
    const n = (await this.d.delete(fuelTransactions).where(and(...w)).returning({ id: fuelTransactions.id })).length;
    if (o.importId) await this.d.delete(fuelImports).where(and(eq(fuelImports.firmId, firmId), eq(fuelImports.id, o.importId)));
    return n;
  }
  async deleteDriverFuel(firmId: string, id: string) {
    const [r] = await this.d.delete(fuelTransactions).where(and(eq(fuelTransactions.firmId, firmId), eq(fuelTransactions.id, id), eq(fuelTransactions.source, "driver"))).returning();
    return r ? txOut(r) : null;
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
    const changed = await this.d.insert(shifts).values({ firmId, truckId: s.truckId, ...v }).onConflictDoUpdate({ target: [shifts.firmId, shifts.truckId], set: v, setWhere: sql`(${shifts.end} is null and ${shifts.start} = ${s.start}) or (${shifts.end} is not null and ${shifts.start} <> ${s.start} and ${s.end}::text is null and ${s.start} > ${shifts.end})` }).returning({ truckId: shifts.truckId });
    if (!changed.length) throw new Error("shift-conflict");
    return s;
  }
  async shift(firmId: string, truckId: string) {
    const [r] = await this.d.select().from(shifts).where(and(eq(shifts.firmId, firmId), eq(shifts.truckId, truckId)));
    return r ? { truckId: r.truckId, start: r.start, end: r.end, checklist: JSON.parse(r.checklist) as string[], privateSince: r.privateSince } : null;
  }
  async savedMapping(firmId: string, sig: string) { const [r] = await this.d.select().from(importMappings).where(and(eq(importMappings.firmId, firmId), eq(importMappings.sig, sig))); return r ? (JSON.parse(r.mapping) as Record<string, number>) : null; }
  async saveMapping(firmId: string, sig: string, m: Record<string, number>) { const v = { mapping: JSON.stringify(m), updatedAt: new Date() }; await this.d.insert(importMappings).values({ firmId, sig, ...v }).onConflictDoUpdate({ target: [importMappings.firmId, importMappings.sig], set: v }); }
  async authFails(key: string) {
    const [r] = await this.d.select().from(authThrottle).where(eq(authThrottle.key, key)).limit(1);
    if (!r) return { fails: 0, lockedUntil: null };
    const lock = r.lockedUntil && r.lockedUntil.getTime() > Date.now() ? r.lockedUntil.toISOString() : null;
    if (!lock && Date.now() - r.firstAt.getTime() > 3600e3) return { fails: 0, lockedUntil: null }; // fereastra de 1 h a expirat
    return { fails: r.fails, lockedUntil: lock };
  }
  /** Atomic: one INSERT … ON CONFLICT DO UPDATE … RETURNING, so concurrent guesses cannot share one count. 1 h window unless locked. */
  async authFail(key: string, lockAfter: number, lockMin: number) {
    const t = sql.raw("auth_throttle");
    const expired = sql`(${t}.first_at < now() - interval '1 hour' and (${t}.locked_until is null or ${t}.locked_until <= now()))`;
    const next = sql`(case when ${expired} then 1 else ${t}.fails + 1 end)`;
    const lockFor = (n: unknown) => sql`(case when ${n} >= ${lockAfter} then now() + make_interval(secs => ${lockMin * 60} * power(2, least(4, ${n} - ${lockAfter}))) else null end)`;
    const result = await this.d.execute(sql`insert into auth_throttle(key, fails, first_at, locked_until) values (${key}, 1, now(), ${lockFor(sql`1`)})
      on conflict (key) do update set fails = ${next}, first_at = case when ${expired} then now() else ${t}.first_at end, locked_until = ${lockFor(next)}
      returning fails, locked_until`);
    const r = result.rows[0] as { fails: number | string; locked_until: Date | string | null };
    const lock = r.locked_until ? new Date(r.locked_until) : null;
    return { fails: Number(r.fails), lockedUntil: lock && lock.getTime() > Date.now() ? lock.toISOString() : null };
  }
  /** Fixed-window rate limit, atomic in one statement. Returns ok=false once more than `limit` hits fall in the window. */
  async rateHit(key: string, limit: number, windowS: number) {
    const t = sql.raw("auth_throttle");
    const expired = sql`(${t}.first_at < now() - make_interval(secs => ${windowS}))`;
    const result = await this.d.execute(sql`insert into auth_throttle(key, fails, first_at) values (${key}, 1, now())
      on conflict (key) do update set fails = case when ${expired} then 1 else ${t}.fails + 1 end, first_at = case when ${expired} then now() else ${t}.first_at end
      returning fails, first_at, (fails <= ${limit}) as ok`);
    const r = result.rows[0] as { fails: number | string; first_at: Date | string; ok: boolean | string } | undefined;
    if (!r) throw new Error("rate-limit-no-row");
    const retryAfterS = Math.max(1, Math.ceil((new Date(r.first_at).getTime() + windowS * 1000 - Date.now()) / 1000));
    return { ok: r.ok === true || r.ok === "t" || r.ok === "true", retryAfterS, used: Number(r.fails) };
  }
  async rateRefund(key: string) { await this.d.execute(sql`update auth_throttle set fails = greatest(0, fails - 1) where key = ${key}`); }
  async authClear(key: string) { await this.d.delete(authThrottle).where(eq(authThrottle.key, key)); }
  async addDriverEvent(firmId: string, e: Omit<DriverEventRow, "id">) { await this.ownTruck(firmId, e.truckId); await this.d.insert(driverEvents).values({ ...e, kind: e.kind, at: new Date(e.at), id: newId("de"), firmId }); }
  async driverEvents(firmId: string, sinceIso: string) {
    const rs = await this.d.select().from(driverEvents).where(and(eq(driverEvents.firmId, firmId), gte(driverEvents.at, new Date(sinceIso)))).orderBy(desc(driverEvents.at)).limit(500);
    return rs.map((r): DriverEventRow => ({ id: r.id, truckId: r.truckId, userId: r.userId, kind: r.kind as DriverEventRow["kind"], at: r.at.toISOString(), lat: r.lat, lng: r.lng, note: r.note }));
  }
  async addDriverPosition(firmId: string, userId: string, p: PosRow) {
    const result = await this.d.execute(sql`select qf_driver_position(${newId("p")}, ${firmId}, ${p.truckId}, ${userId}, ${p.at}, ${p.lat}, ${p.lng}, ${p.capturedAt ?? null}, ${p.accuracy ?? null}) as accepted`);
    return result.rows[0]?.accepted === true;
  }
  async addPosition(firmId: string, p: PosRow) { await this.ownTruck(firmId, p.truckId); await this.d.insert(positions).values({ ...p, id: newId("p"), firmId }); }
  async purgePositions(beforeAt: string) { const r = await this.d.delete(positions).where(lt(positions.at, beforeAt)).returning({ id: positions.id }); return r.length; }
  async positions(firmId: string, sinceAt = "", truckId?: string, untilAt?: string): Promise<PosRow[]> {
    const result: PosRow[] = [];
    let cursor: { at: string; id: string } | undefined;
    // A stable keyset includes every row, including timestamps shared by many trucks.
    for (;;) {
      const page = await this.d.select({ id: positions.id, truckId: positions.truckId, at: positions.at, lat: positions.lat, lng: positions.lng, capturedAt: positions.capturedAt, receivedAt: positions.receivedAt, accuracy: positions.accuracy }).from(positions)
        .where(and(eq(positions.firmId, firmId), gte(positions.at, sinceAt), truckId ? eq(positions.truckId, truckId) : undefined,
          untilAt ? lt(positions.at, untilAt) : undefined,
          cursor ? or(gt(positions.at, cursor.at), and(eq(positions.at, cursor.at), gt(positions.id, cursor.id))) : undefined))
        .orderBy(positions.at, positions.id).limit(2000);
      result.push(...page.map(({ id: _id, ...p }) => p));
      if (page.length < 2000) return result;
      cursor = page[page.length - 1];
    }
  }
  async addLead(l: NewLead) { const [r] = await this.d.insert(leads).values({ ...l, id: newId("l"), consentAt: new Date(l.consentAt) }).returning(); return leadOut(r); }
  async leads() { return (await this.d.select().from(leads).orderBy(desc(leads.createdAt)).limit(300)).map(leadOut); }
  async leadsFromIp(ipHash: string, sinceIso: string) { const [r] = await this.d.select({ n: count() }).from(leads).where(and(eq(leads.ipHash, ipHash), gte(leads.createdAt, new Date(sinceIso)))); return r?.n ?? 0; }
  async support() { return (await this.d.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(200)).map((r) => ({ ...r, createdAt: iso(r.createdAt)! })); }
}
