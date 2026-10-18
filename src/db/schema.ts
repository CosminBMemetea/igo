// Querra Fleet: schema Postgres (Drizzle). Orice rând de date are firm_id; depozitul filtrează MEREU după el.
import { check, customType, jsonb, boolean, date, doublePrecision, index, integer, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

export const firms = pgTable("firms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cui: text("cui"),
  currency: text("currency").notNull().default("RON"),
  trialStart: date("trial_start").notNull(),
  demoMode: boolean("demo_mode").notNull().default(false),
  detailsDone: boolean("details_done").notNull().default(false),
  csvSkipped: boolean("csv_skipped").notNull().default(false),
  /** codul de recomandare al firmei care a adus-o (?ref=) */
  referredBy: text("referred_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // owner | driver
  name: text("name").notNull().default(""),
  email: text("email"),
  emailAlerts: boolean("email_alerts").notNull().default(true),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  sessionVersion: integer("session_version").notNull().default(0),
  /** camionul curent al șoferului (ultima tură) — pentru notificările despre documentele camionului */
  truckId: text("truck_id"),
  /** limba aleasă (ro|en|pl); null = implicit română */
  locale: text("locale"),
  /** dezactivat de patron (șofer plecat): fără acces, sesiunile se resping */
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_phone_uq").on(t.phone), index("users_firm_ix").on(t.firmId), uniqueIndex("users_active_truck_uq").on(t.firmId, t.truckId).where(sql`${t.role} = 'driver' and ${t.disabledAt} is null and ${t.truckId} is not null`)]);

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userId: text("user_id"),
  locale: text("locale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("invites_firm_ix").on(t.firmId)]);

export const trucks = pgTable("trucks", {
  compliance: jsonb("compliance").$type<import("../lib/compliance").VehicleCompliance>(),
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  plate: text("plate").notNull(),
  vin: text("vin"),
  model: text("model"),
  tankL: integer("tank_l"),
  normalL100: real("normal_l100"),
  /** costuri editate de patron (fixe lunare + variabile pe km, capacitate) — JSON parțial peste valorile implicite */
  costHistory: jsonb("cost_history").$type<import("../lib/costs").CostVersion[]>().default([]).notNull(),
  costs: jsonb("costs").$type<Record<string, number>>(),
  /** scos din flotă: istoric păstrat, exclus din calcule */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("trucks_firm_plate_uq").on(t.firmId, t.plate)]);

export const complianceTasks = pgTable("compliance_tasks", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  driverId: text("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), due: date("due").notNull(), status: text("status").$type<import("../lib/store/types").ComplianceTaskRow["status"]>().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("compliance_tasks_firm_ix").on(t.firmId), uniqueIndex("compliance_tasks_active_uq").on(t.firmId, t.truckId, t.type).where(sql`${t.status} in ('open', 'acknowledged')`), check("compliance_tasks_status_check", sql`${t.status} in ('open','acknowledged','done','cancelled')`)]);

export const documents = pgTable("documents", {
  validFrom: date("valid_from"),
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").references(() => trucks.id, { onDelete: "cascade" }),
  /** document de șofer (permis, atestat, card tahograf, medical) */
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("vehicle"), // vehicle | driver
  type: text("type").notNull(),
  expires: date("expires").notNull(),
  dueKm: integer("due_km"),
  note: text("note"),
  fileId: text("file_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documents_firm_ix").on(t.firmId), check("documents_valid_period", sql`${t.validFrom} is null or ${t.validFrom} <= ${t.expires}`)]);

export const trips = pgTable("trips", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  requestKey: text("request_key"),
  requestHash: text("request_hash"),
  client: text("client").notNull(),
  title: text("title").notNull(),
  date: date("date").notNull(),
  km: real("km").notNull(),
  revenue: real("revenue").notNull(),
  litres: real("litres").notNull(),
  fuelPrice: real("fuel_price").notNull(),
  tolls: real("tolls").notNull().default(0),
  driverCost: real("driver_cost").notNull().default(0),
  other: real("other").notNull().default(0),
  /** manual = litri introduși; estimate = estimați din consum (înlocuiți cu bonurile din CSV când există) */
  litresSource: text("litres_source").notNull().default("manual"),
  podReceived: boolean("pod_received").notNull().default(false),
  /** cursă atribuită unui șofer (camionul se completează din camionul lui curent) */
  driverId: text("driver_id"),
  tonnes: real("tonnes"),
  /** planificată (creată din „+ Cursă nouă”); nu intră în profitul realizat până la încheiere */
  loadedAt: text("loaded_at"),
  deliveredAt: text("delivered_at"),
  waitSince: text("wait_since"),
  lastEventAt: text("last_event_at"),
  cancelledAt: text("cancelled_at"),
  cancelReason: text("cancel_reason"),
  planned: boolean("planned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("trips_firm_ix").on(t.firmId), uniqueIndex("trips_firm_request_uq").on(t.firmId, t.requestKey)]);

export const supportRequests = pgTable("support_requests", {
  id: text("id").primaryKey(),
  firmId: text("firm_id"),
  email: text("email"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  slot: text("slot"),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Card carburant → camion (reținut după prima asociere). */
export const fuelCards = pgTable("fuel_cards", {
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  card: text("card").notNull(),
  truckId: text("truck_id").references(() => trucks.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.firmId, t.card] })]);

/** Effective card history. Legacy fuel_cards is retained for deployment compatibility. */
export const fuelCardPeriods = pgTable("fuel_card_periods", {
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  card: text("card").notNull(),
  validFrom: text("valid_from").notNull(),
  truckId: text("truck_id").references(() => trucks.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.firmId, t.card, t.validFrom] })]);

export const fuelImports = pgTable("fuel_imports", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  filename: text("filename").notNull().default(""),
  rows: integer("rows").notNull(),
  added: integer("added").notNull(),
  dupes: integer("dupes").notNull(),
  skipped: integer("skipped").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("fuel_imports_firm_ix").on(t.firmId)]);

/** Alimentări: din CSV-ul cardului (source = dkv|omv|mol|shell|e100|generic) sau de la șofer (source = driver). */
export const fuelTransactions = pgTable("fuel_transactions", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").references(() => trucks.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  importId: text("import_id"),
  /** cheie de deduplicare (card, minut, litri, sumă, stație) */
  hash: text("hash").notNull(),
  card: text("card"),
  plate: text("plate"),
  at: text("at").notNull(), // ora locală „YYYY-MM-DDTHH:MM”
  station: text("station").notNull().default(""),
  country: text("country"),
  product: text("product"),
  litres: real("litres").notNull(),
  amount: real("amount"),
  currency: text("currency"),
  /** suma convertită în lei (curs BCE, prin EUR) + cursul și data cursului folosite; null = RON sau curs indisponibil */
  amountRon: real("amount_ron"),
  fxRate: doublePrecision("fx_rate"),
  fxDate: text("fx_date"),
  odometer: integer("odometer"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  userId: text("user_id"),
  photoName: text("photo_name"),
  photoSize: integer("photo_size"),
  aiRead: boolean("ai_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("fuel_tx_firm_hash_uq").on(t.firmId, t.hash), index("fuel_tx_firm_truck_at_ix").on(t.firmId, t.truckId, t.at), index("fuel_tx_firm_card_at_ix").on(t.firmId, t.card, t.at)]);

export const shifts = pgTable("shifts", {
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  start: text("start").notNull(),
  end: text("end"),
  checklist: text("checklist").notNull().default("[]"),
  /** GDPR: șoferul e în modul „Privat” (pauză) din acest moment; nicio poziție nu se salvează cât e setat. */
  privateSince: text("private_since"),
}, (t) => [primaryKey({ columns: [t.firmId, t.truckId] })]);

/** Poziții GPS (din telefonul șoferului, în tură). */
export const positions = pgTable("positions", {
  capturedAt: text("captured_at"),
  receivedAt: text("received_at"),
  accuracy: doublePrecision("accuracy"),
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  at: text("at").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
}, (t) => [index("positions_firm_truck_at_ix").on(t.firmId, t.truckId, t.at)]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
/** Fișiere (poze CMR/POD, scanuri de documente). storage = blob (Vercel Blob, url) sau db (bytea, max ~2 MB). */
export const files = pgTable("files", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // doc | cmr | pod
  tripId: text("trip_id"),
  docId: text("doc_id"),
  name: text("name").notNull().default(""),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storage: text("storage").notNull(),
  url: text("url"),
  data: bytea("data"),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("files_firm_trip_ix").on(t.firmId, t.tripId), index("files_firm_doc_ix").on(t.firmId, t.docId)]);

/** Notificări în aplicație (clopoțel). userId null = pentru proprietar/admin. key = deduplicare (doc:expirare:prag:destinatar). */
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  key: text("key").notNull(),
  kind: text("kind").notNull(),
  docId: text("doc_id"),
  params: text("params").notNull().default("{}"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("notifications_firm_key_uq").on(t.firmId, t.key), index("notifications_firm_user_ix").on(t.firmId, t.userId)]);

/** Durable outbound delivery queue. Historical table name retained for safe upgrades. sent = provider accepted, not inbox/device receipt. */
export const emailOutbox = pgTable("email_outbox", {
  id: text("id").primaryKey(),
  firmId: text("firm_id"),
  key: text("key").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  providerId: text("provider_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  channel: text("channel").notNull().default("email"),
  context: jsonb("context").$type<import("../lib/store/types").DeliveryContext>(),
  subscriptionId: text("subscription_id"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leaseToken: text("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`now() + interval '48 hours'`),
}, (t) => [uniqueIndex("email_outbox_key_uq").on(t.key), index("email_outbox_due_ix").on(t.status, t.nextAttemptAt)]);

export const pushDevices = pgTable("push_devices", {
  transport: text("transport").$type<"web" | "apns">().notNull().default("web"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  sessionVersion: integer("session_version").notNull(),
  binding: text("binding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("push_devices_endpoint_uq").on(t.endpoint), index("push_devices_user_ix").on(t.firmId, t.userId), index("push_devices_binding_ix").on(t.binding)]);

/** Evenimente pe cursă (de la șofer): încărcat, descărcat, așteptare start/stop. */
export const tripEvents = pgTable("trip_events", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  requestKey: text("request_key"),
  kind: text("kind").notNull(), // loaded | unloaded | wait_start | wait_end
  at: timestamp("at", { withTimezone: true }).notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  userId: text("user_id"),
}, (t) => [index("trip_events_firm_trip_ix").on(t.firmId, t.tripId), uniqueIndex("trip_events_request_uq").on(t.firmId, t.requestKey)]);

/** Maparea coloanelor CSV salvată per firmă, pe semnătura antetului (refolosită la următorul import cu același format). */
export const importMappings = pgTable("import_mappings", {
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  sig: text("sig").notNull(),
  mapping: text("mapping").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.firmId, t.sig] })]);

/** Cache cursuri BCE (euro de referință): 1 EUR = perEur unități din `cur`, publicat la `date` (YYYY-MM-DD). */
export const fxRates = pgTable("fx_rates", {
  date: text("date").notNull(),
  cur: text("cur").notNull(),
  perEur: doublePrecision("per_eur").notNull(),
}, (t) => [uniqueIndex("fx_rates_date_cur_uq").on(t.date, t.cur)]);

/** Cereri „Încearcă gratuit” de pe /incearca (lead-uri). Fără marketing: doar contact pentru probă. */
export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  firm: text("firm").notNull(),
  person: text("person").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  trucks: integer("trucks"),
  fuelCard: text("fuel_card"),
  gps: boolean("gps"),
  gpsProvider: text("gps_provider"),
  locale: text("locale"),
  source: text("source"),
  referralCode: text("referral_code"),
  utm: text("utm"),
  ipHash: text("ip_hash"),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("leads_created_ix").on(t.createdAt), index("leads_ip_ix").on(t.ipHash)]);

/** Jurnalul șoferului: tură, pauză privată, încărcat/descărcat, așteptare, alimentare (fluxul patronului, orele de azi). */
export const driverEvents = pgTable("driver_events", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  kind: text("kind").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  note: text("note"),
}, (t) => [index("driver_events_firm_at_ix").on(t.firmId, t.at)]);

/** Anti-brute-force pentru parolă / PIN: încercări greșite pe cheie (login sau IP), blocare temporară. */
export const authThrottle = pgTable("auth_throttle", {
  key: text("key").primaryKey(),
  fails: integer("fails").notNull().default(0),
  firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/** Istoric șofer → camion (schimbare la începutul turei). */
export const truckAssignments = pgTable("truck_assignments", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  fromTruckId: text("from_truck_id"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("truck_assignments_firm_ix").on(t.firmId, t.at)]);

/** Operational heartbeat only; no recipients or payloads. */
export const notificationJobs = pgTable("notification_jobs", {
  name: text("name").primaryKey(), runId: text("run_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(), finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"), summary: jsonb("summary").$type<Record<string, number>>(),
});
