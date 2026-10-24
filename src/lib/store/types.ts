// Querra Fleet: depozitul de conturi și date per firmă. Toate metodele cu date primesc firmId și filtrează după el.
export type Currency = "RON" | "EUR";
export type VehicleDocType = "itp" | "rca" | "casco" | "vignette" | "tacho" | "copy" | "service";
export type DriverDocType = "licence" | "cpc" | "tachoCard" | "medical";
export type DocType = VehicleDocType | DriverDocType;
export const VEHICLE_DOC_TYPES: VehicleDocType[] = ["itp", "rca", "casco", "vignette", "tacho", "copy", "service"];
export const DRIVER_DOC_TYPES: DriverDocType[] = ["licence", "cpc", "tachoCard", "medical"];
export const DOC_TYPES: DocType[] = [...VEHICLE_DOC_TYPES, ...DRIVER_DOC_TYPES];
export interface FirmRow { id: string; name: string; cui: string | null; currency: Currency; trialStart: string; demoMode: boolean; detailsDone: boolean; csvSkipped: boolean; referredBy: string | null; createdAt: string }
export interface UserRow { id: string; firmId: string; role: "owner" | "driver"; name: string; email: string | null; phone: string | null; passwordHash: string; sessionVersion?: number; disabledAt?: string | null; truckId?: string | null; locale?: string | null; emailAlerts?: boolean }
export interface InviteRow { id: string; firmId: string; name: string; phone: string | null; usedAt: string | null; userId: string | null; createdAt: string; revokedAt?: string | null; locale?: string | null }
export interface TruckRow { compliance?: import("../compliance").VehicleCompliance | null; id: string; firmId: string; plate: string; vin: string | null; model: string | null; tankL: number | null; normalL100: number | null; costs?: Record<string, number> | null; costHistory?: import("../costs").CostVersion[] | null; archivedAt?: string | null }
export interface DocRow { validFrom?: string | null; id: string; firmId: string; truckId: string | null; userId?: string | null; scope?: "vehicle" | "driver"; type: DocType; expires: string; dueKm?: number | null; note?: string | null; fileId?: string | null }
export type NewDoc = Omit<DocRow, "id" | "firmId">;
export interface TripRow { requestKey?: string | null; requestHash?: string | null; loadedAt?: string | null; deliveredAt?: string | null; waitSince?: string | null; lastEventAt?: string | null; cancelledAt?: string | null; cancelReason?: string | null; id: string; firmId: string; truckId: string; client: string; title: string; date: string; km: number; revenue: number; litres: number; fuelPrice: number; tolls: number; driverCost: number; other: number; litresSource?: "manual" | "estimate"; podReceived?: boolean; driverId?: string | null; tonnes?: number | null; planned?: boolean }
export interface LeadRow { id: string; firm: string; person: string; phone: string; email: string; trucks: number | null; fuelCard: string | null; gps: boolean | null; gpsProvider: string | null; locale: string | null; source: string | null; referralCode: string | null; utm: string | null; ipHash: string | null; consentAt: string; status: string; createdAt: string }
export type NewLead = Omit<LeadRow, "id" | "status" | "createdAt">;
export interface SupportRow { id: string; firmId: string | null; email: string | null; name: string; phone: string; slot: string | null; message: string; status: string; createdAt: string }

export interface FuelTxRow { id: string; firmId: string; truckId: string | null; source: string; importId: string | null; hash: string; card: string | null; plate: string | null; at: string; station: string; country: string | null; product: string | null; litres: number; amount: number | null; currency: string | null; amountRon: number | null; fxRate: number | null; fxDate: string | null; odometer: number | null; lat: number | null; lng: number | null; userId: string | null; photoName: string | null; photoSize: number | null; aiRead: boolean }
export type NewFuelTx = Omit<FuelTxRow, "id" | "firmId">;
export interface CardRow { card: string; truckId: string | null; validFrom: string }
export interface ImportRow { id: string; firmId: string; source: string; filename: string; rows: number; added: number; dupes: number; skipped: number; createdAt: string }
export interface ShiftRow { truckId: string; start: string; end: string | null; checklist: string[]; privateSince?: string | null }
export type DriverEventKind = "truck_switch" | "shift_start" | "shift_end" | "private_on" | "private_off" | "loaded" | "unloaded" | "wait_start" | "wait_end" | "fill";
export interface DriverEventRow { id: string; truckId: string; userId: string | null; kind: DriverEventKind; at: string; lat: number | null; lng: number | null; note: string | null }
export interface PosRow { truckId: string; at: string; lat: number; lng: number; capturedAt?: string | null; receivedAt?: string | null; accuracy?: number | null }

export type FileKind = "doc" | "cmr" | "pod" | "receipt";
export interface FileMeta { id: string; firmId: string; kind: FileKind; tripId: string | null; docId: string | null; name: string; mime: string; size: number; storage: "blob" | "db"; url: string | null; userId: string | null; createdAt: string }
export type NewFile = Omit<FileMeta, "id" | "firmId" | "createdAt"> & { data: Buffer | null; id?: string };
export interface NotificationRow { id: string; firmId: string; userId: string | null; key: string; kind: string; docId: string | null; params: Record<string, string | number>; readAt: string | null; createdAt: string }
export type NewNotification = Omit<NotificationRow, "id" | "firmId" | "readAt" | "createdAt">;
export type EmailStatus = "sent" | "queued" | "failed" | "processing" | "cancelled";
export type DeliveryContext = { kind: "document"; userId: string; docId: string; expires: string; stage: string } | { kind: "task"; userId: string; taskId: string; status: string } | { kind: "account"; userId: string; version: number } | { kind: "test"; userId: string } | { kind: "speed"; userId: string; eventId: string };
export interface DeliveryFields { channel: "email" | "push"; context: DeliveryContext | null; subscriptionId: string | null; attempts: number; nextAttemptAt: string; leaseToken: string | null; leaseUntil: string | null; firstAttemptAt: string | null; expiresAt: string }
export interface PushDevice { transport?: "web" | "apns" | "fcm"; nativeSessionId?: string | null; validUntil?: string | null; id: string; firmId: string; userId: string; endpoint: string; p256dh: string; auth: string; sessionVersion: number; binding: string; createdAt: string }
export type NewEmail = Pick<EmailRow, "firmId" | "key" | "to" | "subject" | "body"> & Partial<Pick<DeliveryFields, "channel" | "context" | "subscriptionId" | "expiresAt">>;
export type DeliveryFinish = { status: EmailStatus; error: string | null; providerId?: string | null; nextAttemptAt?: string };
export interface EmailRow extends DeliveryFields { id: string; firmId: string | null; key: string; to: string; subject: string; body: string; status: EmailStatus; error: string | null; providerId: string | null; createdAt: string; sentAt: string | null }
export type TripEventKind = "loaded" | "unloaded" | "wait_start" | "wait_end";
export interface TripEventRow { requestKey?: string | null; id: string; firmId: string; tripId: string; kind: TripEventKind; at: string; lat: number | null; lng: number | null; userId: string | null }

export interface ComplianceTaskRow { id: string; firmId: string; truckId: string; driverId: string; type: string; due: string; status: "open" | "acknowledged" | "done" | "cancelled"; createdAt: string; updatedAt: string }
export interface NotificationJob { name: string; runId: string; startedAt: string; finishedAt: string | null; error: string | null; summary: Record<string, number> | null }
export interface Store {
  startNotificationJob(name: string, runId: string, at: string): Promise<void>;
  finishNotificationJob(name: string, runId: string, summary: Record<string, number> | null, error: string | null): Promise<void>;
  notificationJobs(): Promise<NotificationJob[]>;
  complianceTasks(firmId: string): Promise<ComplianceTaskRow[]>;
  addComplianceTask(firmId: string, task: Pick<ComplianceTaskRow, "truckId" | "driverId" | "type" | "due">): Promise<ComplianceTaskRow | null>;
  updateComplianceTask(firmId: string, id: string, status: "acknowledged" | "done" | "cancelled", driverId?: string): Promise<boolean>;
  readonly persistent: boolean;
  createFirm(f: Pick<FirmRow, "name" | "cui"> & { referredBy?: string | null }): Promise<FirmRow>;
  firm(id: string): Promise<FirmRow | null>;
  firms(): Promise<(FirmRow & { trucks: number; users: number })[]>;
  updateFirm(id: string, p: Partial<Pick<FirmRow, "name" | "cui" | "currency" | "demoMode" | "detailsDone" | "csvSkipped">>): Promise<void>;
  createUser(u: Omit<UserRow, "id">): Promise<UserRow>;
  userByLogin(login: string): Promise<UserRow | null>;
  users(firmId: string): Promise<UserRow[]>;
  userById(id: string): Promise<UserRow | null>;
  /** admin Querra: câte rânduri are firma pe fiecare tabel / ștergere completă (tranzacție) */
  firmCounts(firmId: string): Promise<Record<string, number>>;
  deleteFirm(firmId: string): Promise<{ counts: Record<string, number>; blobUrls: string[] }>;
  setUserPassword(id: string, passwordHash: string): Promise<void>;
  /** dezactivare șofer: sesiunile existente sunt respinse la următoarea cerere, nu se mai poate autentifica */
  setUserDisabled(firmId: string, userId: string, off: boolean): Promise<boolean>;
  createInvite(firmId: string, name: string, phone: string | null, locale?: string | null): Promise<InviteRow>;
  setUserLocale(id: string, locale: string): Promise<void>;
  invite(firmId: string, id: string): Promise<InviteRow | null>;
  invites(firmId: string): Promise<InviteRow[]>;
  acceptInvite(firmId: string, id: string, phone: string, passwordHash: string): Promise<UserRow | null>;
  createDriverInvite(firmId: string, name: string, phone: string, locale: string): Promise<InviteRow>;
  cancelTrip(firmId: string, id: string, reason: string): Promise<boolean>;
  completeTrip(firmId: string, id: string): Promise<boolean>;
  recordTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId"> & { requestKey: string; expectedShiftStart?: string; expectedTruckId?: string }): Promise<{ event: TripEventRow; duplicate: boolean }>;
  editPlannedTrip(firmId: string, id: string, patch: Omit<TripRow, "id" | "firmId">): Promise<boolean>;
  updateTrip(firmId: string, id: string, patch: { revenue?: number; tonnes?: number | null; planned?: boolean }): Promise<boolean>;
  useInvite(firmId: string, id: string, userId: string): Promise<boolean>;
  updateComplianceBatch(firmId: string, changes: import("../compliance-csv").ComplianceUpdate[]): Promise<boolean>;
  addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">): Promise<TruckRow>;
  trucks(firmId: string): Promise<TruckRow[]>;
  updateTruck(firmId: string, id: string, p: { plate: string; vin?: string | null; model: string | null; tankL: number | null; normalL100: number | null; compliance?: import("../compliance").VehicleCompliance | null }): Promise<boolean>;
  setUserEmail(id: string, email: string): Promise<void>;
  updateTruckEcon(firmId: string, id: string, p: { costs?: Record<string, number>; archived?: boolean }): Promise<boolean>;
  /** Documentul trebuie să aparțină unui camion SAU unui șofer al firmei. */
  addDoc(firmId: string, d: NewDoc): Promise<DocRow>;
  updateDoc(firmId: string, id: string, d: Partial<NewDoc>): Promise<DocRow | null>;
  deleteDoc(firmId: string, id: string): Promise<boolean>;
  setUserTruck(firmId: string, userId: string, truckId: string | null): Promise<void>;
  renewInvite(firmId: string, id: string): Promise<boolean>;
  revokeInvite(firmId: string, id: string): Promise<boolean>;
  setPod(firmId: string, tripId: string, received: boolean): Promise<boolean>;
  addFile(firmId: string, f: NewFile): Promise<FileMeta>;
  /** Metadate + conținut (pentru stocarea în db). Doar din firma dată. */
  file(firmId: string, id: string): Promise<(FileMeta & { data: Buffer | null }) | null>;
  files(firmId: string, o: { tripId?: string; docId?: string }): Promise<FileMeta[]>;
  deleteFile(firmId: string, id: string): Promise<boolean>;
  /** Inserează cu deduplicare pe (firmId, key); întoarce doar cele noi. */
  addNotifications(firmId: string, n: NewNotification[]): Promise<NotificationRow[]>;
  notifications(firmId: string, userId: string | null, limit?: number): Promise<NotificationRow[]>;
  markRead(firmId: string, userId: string | null): Promise<void>;
  /** Deduplicare globală pe key; întoarce null dacă exista deja. */
  addEmail(e: NewEmail): Promise<EmailRow | null>;
  setEmailStatus(id: string, status: EmailStatus, error: string | null, providerId: string | null): Promise<void>;
  emails(limit?: number): Promise<EmailRow[]>;
  claimDelivery(channels: ("email" | "push")[], now: string, id?: string): Promise<EmailRow | null>;
  finishDelivery(id: string, token: string, patch: DeliveryFinish): Promise<boolean>;
  savePushDevice(d: Omit<PushDevice, "id" | "createdAt">): Promise<PushDevice>;
  pushDevices(firmId: string, userId: string): Promise<PushDevice[]>;
  removePushDevice(firmId: string, userId: string, id?: string, binding?: string): Promise<void>;
  revokePushBinding(binding: string): Promise<void>;
  revokeMobileSession(id: string, expiresAt: string): Promise<void>;
  mobileSessionRevoked(id: string): Promise<boolean>;
  setEmailAlerts(firmId: string, userId: string, enabled: boolean): Promise<void>;
  addTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId">): Promise<TripEventRow>;
  tripEvents(firmId: string, tripId: string): Promise<TripEventRow[]>;
  docs(firmId: string): Promise<DocRow[]>;
  addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">): Promise<TripRow>;
  /** cursa urmează camionul folosit efectiv (șoferul a schimbat camionul la începutul turei) */
  setTripTruck(firmId: string, tripId: string, truckId: string): Promise<void>;
  addAssignment(firmId: string, a: { userId: string; truckId: string; fromTruckId: string | null }): Promise<void>;
  assignments(firmId: string, userId?: string): Promise<{ userId: string; truckId: string; fromTruckId: string | null; at: string }[]>;
  trips(firmId: string): Promise<TripRow[]>;
  addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">): Promise<SupportRow>;
  support(): Promise<SupportRow[]>;
  addLead(l: NewLead): Promise<LeadRow>;
  leads(): Promise<LeadRow[]>;
  /** câte cereri de la același IP (hash) după momentul dat — pentru limitare */
  leadsFromIp(ipHash: string, sinceIso: string): Promise<number>;
  // carburant
  fuelCards(firmId: string): Promise<CardRow[]>;
  /** Adds an effective boundary [validFrom, next boundary), preserving earlier/later periods. Conflicting boundaries/plates are rejected. */
  setCard(firmId: string, card: string, truckId: string, validFrom: string): Promise<number>;
  /** Inserează cu deduplicare pe (firm_id, hash). */
  addFuel(firmId: string, rows: NewFuelTx[]): Promise<{ added: number; dupes: number }>;
  fuelByHash(firmId: string, hash: string): Promise<FuelTxRow | null>;
  /** Owner correction of a driver-entered receipt; only source "driver" rows of the firm. */
  updateDriverFuel(firmId: string, id: string, p: { litres: number; amount: number | null; odometer: number | null; station: string }): Promise<FuelTxRow | null>;
  /** Deletes a driver-entered receipt of the firm; returns the deleted row (to remove its photo). Alerts are derived, so they recompute. */
  deleteDriverFuel(firmId: string, id: string): Promise<FuelTxRow | null>;
  /** Șterge definitiv cursa firmei și evenimentele ei (încărcat/descărcat/așteptare). Fișierele se șterg separat (Blob). */
  deleteTrip(firmId: string, id: string): Promise<boolean>;
  /** Rânduri de carburant importate (nu bonuri de șofer): unul după id sau tot lotul unui import. Întoarce câte s-au șters. */
  deleteImportedFuel(firmId: string, o: { id?: string; importId?: string }): Promise<number>;
  fuel(firmId: string, o?: { truckId?: string; source?: string; limit?: number }): Promise<FuelTxRow[]>;
  addImport(firmId: string, i: Omit<ImportRow, "id" | "firmId" | "createdAt"> & { id?: string }): Promise<ImportRow>;
  imports(firmId: string): Promise<ImportRow[]>;
  setShift(firmId: string, s: ShiftRow): Promise<ShiftRow>;
  shift(firmId: string, truckId: string): Promise<ShiftRow | null>;
  savedMapping(firmId: string, sig: string): Promise<Record<string, number> | null>;
  saveMapping(firmId: string, sig: string, m: Record<string, number>): Promise<void>;
  addDriverPosition(firmId: string, userId: string, p: PosRow): Promise<boolean>;
  addPosition(firmId: string, p: PosRow): Promise<void>;
  positions(firmId: string, sinceAt?: string, truckId?: string, untilAt?: string): Promise<PosRow[]>;
  /** GDPR retention: deletes GPS points older than `beforeAt` (all firms). Trips keep their own km/summary. */
  purgePositions(beforeAt: string): Promise<number>;
  speedSettings(firmId: string): Promise<import("../speed").SpeedSettings>;
  setSpeedSettings(firmId: string, s: import("../speed").SpeedSettings): Promise<void>;
  openSpeedEvent(firmId: string, truckId: string): Promise<import("../speed").SpeedEventRow | null>;
  /** Insert or update by id; the truck must belong to the firm. */
  saveSpeedEvent(firmId: string, e: import("../speed").SpeedEventRow): Promise<void>;
  deleteSpeedEvent(firmId: string, id: string): Promise<void>;
  /** Owner-alert delivery state only (never touches motion fields, so a concurrent reading cannot undo it). */
  updateSpeedNotify(firmId: string, id: string, p: import("../speed").SpeedNotifyPatch): Promise<void>;
  /** Atomically leases a due, undelivered alert (notify_next_at := leaseUntil) and returns its fresh row; null if not due or already claimed. */
  claimSpeedNotify(firmId: string, id: string, nowIso: string, leaseUntilIso: string, maxAttempts: number): Promise<import("../speed").SpeedEventRow | null>;
  /** Due, undelivered owner alerts (open or closed). Without firmId: all firms (cron only). */
  pendingSpeedNotifications(o: { firmId?: string; dueAt: string; maxAttempts: number; limit: number }): Promise<(import("../speed").SpeedEventRow & { firmId: string })[]>;
  speedEvents(firmId: string, o?: { sinceAt?: string; untilAt?: string; truckId?: string; userId?: string; limit?: number }): Promise<import("../speed").SpeedEventRow[]>;
  /** Retention: deletes speeding events that started before `beforeIso` (all firms). */
  purgeSpeedEvents(beforeIso: string): Promise<number>;
  /** jurnalul șoferului (tură, pauză privată, încărcat/descărcat, alimentare) — pentru fluxul patronului și orele de azi */
  /** anti-brute-force: încercări greșite de autentificare pe cheie (login / IP) */
  authFails(key: string): Promise<{ fails: number; lockedUntil: string | null }>;
  authFail(key: string, lockAfter: number, lockMin: number): Promise<{ fails: number; lockedUntil: string | null }>;
  authClear(key: string): Promise<void>;
  /** DB-backed fixed-window limiter (shared auth_throttle table; keys prefixed rl:). */
  rateHit(key: string, limit: number, windowS: number): Promise<{ ok: boolean; retryAfterS: number; used?: number }>;
  /** Give back one hit (e.g. the upstream provider failed). Never below zero. */
  rateRefund(key: string): Promise<void>;
  addDriverEvent(firmId: string, e: Omit<DriverEventRow, "id">): Promise<void>;
  driverEvents(firmId: string, sinceIso: string): Promise<DriverEventRow[]>;
}
export const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const today = () => new Date().toISOString().slice(0, 10);
