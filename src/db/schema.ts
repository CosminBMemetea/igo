// iGo: schema Postgres (Drizzle). Orice rând de date are firm_id; depozitul filtrează MEREU după el.
import { boolean, date, doublePrecision, index, integer, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const firms = pgTable("firms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cui: text("cui"),
  currency: text("currency").notNull().default("RON"),
  trialStart: date("trial_start").notNull(),
  demoMode: boolean("demo_mode").notNull().default(false),
  detailsDone: boolean("details_done").notNull().default(false),
  csvSkipped: boolean("csv_skipped").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // owner | driver
  name: text("name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_phone_uq").on(t.phone), index("users_firm_ix").on(t.firmId)]);

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("invites_firm_ix").on(t.firmId)]);

export const trucks = pgTable("trucks", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  plate: text("plate").notNull(),
  vin: text("vin"),
  model: text("model"),
  tankL: integer("tank_l"),
  normalL100: real("normal_l100"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("trucks_firm_plate_uq").on(t.firmId, t.plate)]);

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // itp | rca | casco | vignette | tacho
  expires: date("expires").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documents_firm_ix").on(t.firmId)]);

export const trips = pgTable("trips", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("trips_firm_ix").on(t.firmId)]);

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
  odometer: integer("odometer"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  userId: text("user_id"),
  photoName: text("photo_name"),
  photoSize: integer("photo_size"),
  aiRead: boolean("ai_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("fuel_tx_firm_hash_uq").on(t.firmId, t.hash), index("fuel_tx_firm_truck_at_ix").on(t.firmId, t.truckId, t.at)]);

export const shifts = pgTable("shifts", {
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  start: text("start").notNull(),
  end: text("end"),
  checklist: text("checklist").notNull().default("[]"),
}, (t) => [primaryKey({ columns: [t.firmId, t.truckId] })]);

/** Poziții GPS (din telefonul șoferului, în tură). */
export const positions = pgTable("positions", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  truckId: text("truck_id").notNull().references(() => trucks.id, { onDelete: "cascade" }),
  at: text("at").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
}, (t) => [index("positions_firm_truck_at_ix").on(t.firmId, t.truckId, t.at)]);
