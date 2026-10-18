import { writableFirm } from "@/lib/tenant";
import { store } from "@/lib/store";
import { csv, PROFILE_HEADERS } from "@/lib/compliance-csv";
import { vehicleCompliance, roadRegime } from "@/lib/compliance";
import { todayFor } from "@/lib/today";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const firm = await writableFirm();
  if (!firm) return Response.json({ error: "forbidden" }, { status: 403 });
  const s = store(), [trucks, docs] = await Promise.all([s.trucks(firm.id), s.docs(firm.id)]);
  const active = trucks.filter(t => !t.archivedAt), today = todayFor();
  const profiles = new URL(req.url).searchParams.get("mode") === "profiles";
  const rows: unknown[][] = profiles ? [Array.from(PROFILE_HEADERS), ...active.map(t => [t.plate, ...PROFILE_HEADERS.slice(1).map(k => t.compliance?.[k as keyof NonNullable<typeof t.compliance>] ?? "")])] : [
    ["plate", "category", "road_regime", "document", "state", "valid_from", "expires", "source", "as_of"],
    ...active.flatMap(t => vehicleCompliance(t.compliance, docs.filter(d => d.truckId === t.id), today).map(i => [t.plate, t.compliance?.category, roadRegime(t.compliance), i.type, i.state, i.doc?.validFrom, i.doc?.expires, "declared_not_officially_verified", today])),
  ];
  return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="querra-${profiles ? "vehicle-profiles" : "compliance"}-${today}.csv"`, "cache-control": "private, no-store" } });
}
