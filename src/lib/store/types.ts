// Querra Fleet: depozitul de conturi și date per firmă. Toate metodele cu date primesc firmId și filtrează după el.
export type Currency = "RON" | "EUR";
export type VehicleDocType = "itp" | "rca" | "casco" | "vignette" | "tacho" | "copy" | "service";
export type DriverDocType = "licence" | "cpc" | "tachoCard" | "medical";
export type DocType = VehicleDocType | DriverDocType;
export const VEHICLE_DOC_TYPES: VehicleDocType[] = ["itp", "rca", "casco", "vignette", "tacho", "copy", "service"];
export const DRIVER_DOC_TYPES: DriverDocType[] = ["licence", "cpc", "tachoCard", "medical"];
export const DOC_TYPES: DocType[] = [...VEHICLE_DOC_TYPES, ...DRIVER_DOC_TYPES];
export interface FirmRow { id: string; name: string; cui: string | null; currency: Currency; trialStart: string; demoMode: boolean; detailsDone: boolean; csvSkipped: boolean; createdAt: string }
export interface UserRow { id: string; firmId: string; role: "owner" | "driver"; name: string; email: string | null; phone: string | null; passwordHash: string; truckId?: string | null; locale?: string | null }
export interface InviteRow { id: string; firmId: string; name: string; phone: string | null; usedAt: string | null; userId: string | null; createdAt: string; revokedAt?: string | null; locale?: string | null }
export interface TruckRow { id: string; firmId: string; plate: string; vin: string | null; model: string | null; tankL: number | null; normalL100: number | null }
export interface DocRow { id: string; firmId: string; truckId: string | null; userId?: string | null; scope?: "vehicle" | "driver"; type: DocType; expires: string; dueKm?: number | null; note?: string | null; fileId?: string | null }
export type NewDoc = Omit<DocRow, "id" | "firmId">;
export interface TripRow { id: string; firmId: string; truckId: string; client: string; title: string; date: string; km: number; revenue: number; litres: number; fuelPrice: number; tolls: number; driverCost: number; other: number; litresSource?: "manual" | "estimate"; podReceived?: boolean }
export interface SupportRow { id: string; firmId: string | null; email: string | null; name: string; phone: string; slot: string | null; message: string; status: string; createdAt: string }

export interface FuelTxRow { id: string; firmId: string; truckId: string | null; source: string; importId: string | null; hash: string; card: string | null; plate: string | null; at: string; station: string; country: string | null; product: string | null; litres: number; amount: number | null; currency: string | null; amountRon: number | null; fxRate: number | null; fxDate: string | null; odometer: number | null; lat: number | null; lng: number | null; userId: string | null; photoName: string | null; photoSize: number | null; aiRead: boolean }
export type NewFuelTx = Omit<FuelTxRow, "id" | "firmId">;
export interface CardRow { card: string; truckId: string | null }
export interface ImportRow { id: string; firmId: string; source: string; filename: string; rows: number; added: number; dupes: number; skipped: number; createdAt: string }
export interface ShiftRow { truckId: string; start: string; end: string | null; checklist: string[]; privateSince?: string | null }
export interface PosRow { truckId: string; at: string; lat: number; lng: number }

export type FileKind = "doc" | "cmr" | "pod";
export interface FileMeta { id: string; firmId: string; kind: FileKind; tripId: string | null; docId: string | null; name: string; mime: string; size: number; storage: "blob" | "db"; url: string | null; userId: string | null; createdAt: string }
export type NewFile = Omit<FileMeta, "id" | "firmId" | "createdAt"> & { data: Buffer | null };
export interface NotificationRow { id: string; firmId: string; userId: string | null; key: string; kind: string; docId: string | null; params: Record<string, string | number>; readAt: string | null; createdAt: string }
export type NewNotification = Omit<NotificationRow, "id" | "firmId" | "readAt" | "createdAt">;
export type EmailStatus = "sent" | "queued" | "failed";
export interface EmailRow { id: string; firmId: string | null; key: string; to: string; subject: string; body: string; status: EmailStatus; error: string | null; providerId: string | null; createdAt: string; sentAt: string | null }
export type TripEventKind = "loaded" | "unloaded" | "wait_start" | "wait_end";
export interface TripEventRow { id: string; firmId: string; tripId: string; kind: TripEventKind; at: string; lat: number | null; lng: number | null; userId: string | null }

export interface Store {
  readonly persistent: boolean;
  createFirm(f: Pick<FirmRow, "name" | "cui">): Promise<FirmRow>;
  firm(id: string): Promise<FirmRow | null>;
  firms(): Promise<(FirmRow & { trucks: number; users: number })[]>;
  updateFirm(id: string, p: Partial<Pick<FirmRow, "name" | "cui" | "currency" | "demoMode" | "detailsDone" | "csvSkipped">>): Promise<void>;
  createUser(u: Omit<UserRow, "id">): Promise<UserRow>;
  userByLogin(login: string): Promise<UserRow | null>;
  users(firmId: string): Promise<UserRow[]>;
  createInvite(firmId: string, name: string, phone: string | null, locale?: string | null): Promise<InviteRow>;
  setUserLocale(id: string, locale: string): Promise<void>;
  invite(firmId: string, id: string): Promise<InviteRow | null>;
  invites(firmId: string): Promise<InviteRow[]>;
  useInvite(firmId: string, id: string, userId: string): Promise<boolean>;
  addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">): Promise<TruckRow>;
  trucks(firmId: string): Promise<TruckRow[]>;
  /** Documentul trebuie să aparțină unui camion SAU unui șofer al firmei. */
  addDoc(firmId: string, d: NewDoc): Promise<DocRow>;
  updateDoc(firmId: string, id: string, d: Partial<NewDoc>): Promise<DocRow | null>;
  deleteDoc(firmId: string, id: string): Promise<boolean>;
  setUserTruck(firmId: string, userId: string, truckId: string | null): Promise<void>;
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
  addEmail(e: Omit<EmailRow, "id" | "createdAt" | "sentAt" | "status" | "error" | "providerId">): Promise<EmailRow | null>;
  setEmailStatus(id: string, status: EmailStatus, error: string | null, providerId: string | null): Promise<void>;
  emails(limit?: number): Promise<EmailRow[]>;
  addTripEvent(firmId: string, e: Omit<TripEventRow, "id" | "firmId">): Promise<TripEventRow>;
  tripEvents(firmId: string, tripId: string): Promise<TripEventRow[]>;
  docs(firmId: string): Promise<DocRow[]>;
  addTrip(firmId: string, t: Omit<TripRow, "id" | "firmId">): Promise<TripRow>;
  trips(firmId: string): Promise<TripRow[]>;
  addSupport(s: Omit<SupportRow, "id" | "status" | "createdAt">): Promise<SupportRow>;
  support(): Promise<SupportRow[]>;
  // carburant
  fuelCards(firmId: string): Promise<CardRow[]>;
  /** Reține cardul → camion și atribuie tranzacțiile acelui card. Camionul trebuie să fie al firmei. Întoarce câte tranzacții s-au mutat. */
  setCard(firmId: string, card: string, truckId: string | null): Promise<number>;
  /** Inserează cu deduplicare pe (firm_id, hash). */
  addFuel(firmId: string, rows: NewFuelTx[]): Promise<{ added: number; dupes: number }>;
  fuel(firmId: string, o?: { truckId?: string; source?: string; limit?: number }): Promise<FuelTxRow[]>;
  addImport(firmId: string, i: Omit<ImportRow, "id" | "firmId" | "createdAt"> & { id?: string }): Promise<ImportRow>;
  imports(firmId: string): Promise<ImportRow[]>;
  setShift(firmId: string, s: ShiftRow): Promise<ShiftRow>;
  shift(firmId: string, truckId: string): Promise<ShiftRow | null>;
  savedMapping(firmId: string, sig: string): Promise<Record<string, number> | null>;
  saveMapping(firmId: string, sig: string, m: Record<string, number>): Promise<void>;
  addPosition(firmId: string, p: PosRow): Promise<void>;
  positions(firmId: string, sinceAt?: string): Promise<PosRow[]>;
}
export const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const today = () => new Date().toISOString().slice(0, 10);
