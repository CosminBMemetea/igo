// iGo: depozitul de conturi și date per firmă. Toate metodele cu date primesc firmId și filtrează după el.
export type Currency = "RON" | "EUR";
export type DocType = "itp" | "rca" | "casco" | "vignette" | "tacho";
export const DOC_TYPES: DocType[] = ["itp", "rca", "casco", "vignette", "tacho"];
export interface FirmRow { id: string; name: string; cui: string | null; currency: Currency; trialStart: string; demoMode: boolean; detailsDone: boolean; csvSkipped: boolean; createdAt: string }
export interface UserRow { id: string; firmId: string; role: "owner" | "driver"; name: string; email: string | null; phone: string | null; passwordHash: string }
export interface InviteRow { id: string; firmId: string; name: string; phone: string | null; usedAt: string | null; userId: string | null; createdAt: string }
export interface TruckRow { id: string; firmId: string; plate: string; vin: string | null; model: string | null; tankL: number | null; normalL100: number | null }
export interface DocRow { id: string; firmId: string; truckId: string; type: DocType; expires: string }
export interface TripRow { id: string; firmId: string; truckId: string; client: string; title: string; date: string; km: number; revenue: number; litres: number; fuelPrice: number; tolls: number; driverCost: number; other: number }
export interface SupportRow { id: string; firmId: string | null; email: string | null; name: string; phone: string; slot: string | null; message: string; status: string; createdAt: string }

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
}
export const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const today = () => new Date().toISOString().slice(0, 10);
