// iGo: depozitul de conturi și date per firmă. Toate metodele cu date primesc firmId și filtrează după el.
export type Currency = "RON" | "EUR";
export type DocType = "itp" | "rca" | "casco" | "vignette" | "tacho";
export const DOC_TYPES: DocType[] = ["itp", "rca", "casco", "vignette", "tacho"];
export interface FirmRow { id: string; name: string; cui: string | null; currency: Currency; trialStart: string; demoMode: boolean; detailsDone: boolean; csvSkipped: boolean; createdAt: string }
export interface UserRow { id: string; firmId: string; role: "owner" | "driver"; name: string; email: string | null; phone: string | null; passwordHash: string }
export interface InviteRow { id: string; firmId: string; name: string; phone: string | null; usedAt: string | null; userId: string | null; createdAt: string }
export interface TruckRow { id: string; firmId: string; plate: string; vin: string | null; model: string | null; tankL: number | null; normalL100: number | null }
export interface DocRow { id: string; firmId: string; truckId: string; type: DocType; expires: string }
export interface TripRow { id: string; firmId: string; truckId: string; client: string; title: string; date: string; km: number; revenue: number; litres: number; fuelPrice: number; tolls: number; driverCost: number; other: number; litresSource?: "manual" | "estimate" }
export interface SupportRow { id: string; firmId: string | null; email: string | null; name: string; phone: string; slot: string | null; message: string; status: string; createdAt: string }

export interface FuelTxRow { id: string; firmId: string; truckId: string | null; source: string; importId: string | null; hash: string; card: string | null; plate: string | null; at: string; station: string; country: string | null; product: string | null; litres: number; amount: number | null; currency: string | null; odometer: number | null; lat: number | null; lng: number | null; userId: string | null; photoName: string | null; photoSize: number | null; aiRead: boolean }
export type NewFuelTx = Omit<FuelTxRow, "id" | "firmId">;
export interface CardRow { card: string; truckId: string | null }
export interface ImportRow { id: string; firmId: string; source: string; filename: string; rows: number; added: number; dupes: number; skipped: number; createdAt: string }
export interface ShiftRow { truckId: string; start: string; end: string | null; checklist: string[] }
export interface PosRow { truckId: string; at: string; lat: number; lng: number }

export interface Store {
  readonly persistent: boolean;
  createFirm(f: Pick<FirmRow, "name" | "cui">): Promise<FirmRow>;
  firm(id: string): Promise<FirmRow | null>;
  firms(): Promise<(FirmRow & { trucks: number; users: number })[]>;
  updateFirm(id: string, p: Partial<Pick<FirmRow, "name" | "cui" | "currency" | "demoMode" | "detailsDone" | "csvSkipped">>): Promise<void>;
  createUser(u: Omit<UserRow, "id">): Promise<UserRow>;
  userByLogin(login: string): Promise<UserRow | null>;
  users(firmId: string): Promise<UserRow[]>;
  createInvite(firmId: string, name: string, phone: string | null): Promise<InviteRow>;
  invite(firmId: string, id: string): Promise<InviteRow | null>;
  invites(firmId: string): Promise<InviteRow[]>;
  useInvite(firmId: string, id: string, userId: string): Promise<boolean>;
  addTruck(firmId: string, t: Omit<TruckRow, "id" | "firmId">): Promise<TruckRow>;
  trucks(firmId: string): Promise<TruckRow[]>;
  addDoc(firmId: string, d: Omit<DocRow, "id" | "firmId">): Promise<DocRow>;
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
  addPosition(firmId: string, p: PosRow): Promise<void>;
  positions(firmId: string, sinceAt?: string): Promise<PosRow[]>;
}
export const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const today = () => new Date().toISOString().slice(0, 10);
