export type Trip = { id: string; truckId: string; title: string; date: string; client: string; cancelReason?: string | null; waitSince?: string | null; planned?: boolean; loadedAt?: string | null; deliveredAt?: string | null; cancelledAt?: string | null; podReceived?: boolean; localPending?: boolean };
export type Board = {
  logoutReceipt?: string;
  alerts?: { id: string; kind: string; label: string; type: string; expires: string }[];
  name: string; firm: string; truck: { id: string; plate: string } | null;
  shift: { start: string; end: string | null; privateSince?: string | null } | null;
  trips: Record<string, Trip[]>;
  road?: { regime: "vignette" | "tollro" | "unknown"; category: string | null; mtmaKg: number | null; euro: string | null; documents: { type: string; state: string; expires: string | null }[] } | null;
  progress?: { completed: number; lifetime: number; rank: number | null; participants: number; badges: { count: number; label: string }[]; next: { count: number; label: string } | null };
  position?: { lat: number; lng: number; at: string; accuracy: number | null } | null;
  serverTime: string;
  paperwork?: { id: string; tripId: string; kind: "cmr" | "pod"; name: string; createdAt: string }[];
};
export function tripFocus(board: Board | null) {
  const running = board?.trips.running ?? [], ready = board?.trips.ready ?? [], upcoming = board?.trips.upcoming ?? [];
  const current = running.find(t => t.truckId === board?.truck?.id);
  const next = ready.find(t => t.truckId === board?.truck?.id) ?? upcoming.find(t => t.truckId === board?.truck?.id);
  return { current, next, hasWork: [...running, ...ready].some(t => t.truckId === board?.truck?.id) };
}
export function invitationPhone(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["qfleet-driver:", "qfleet-driver-test:"].includes(parsed.protocol) || parsed.hostname !== "login") return null;
    const phone = parsed.searchParams.get("phone") ?? "";
    return /^\+?[\d ()-]{7,25}$/.test(phone) ? phone : null;
  } catch { return null; }
}
