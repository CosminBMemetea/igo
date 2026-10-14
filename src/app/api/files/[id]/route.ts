import { driverTrip } from "@/lib/driver-access";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
import { readFile } from "@/lib/files";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
/** Servește fișierul doar dacă aparține firmei sesiunii (și pentru Blob trece prin server: URL-ul nu ajunge la client). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tn = await tenant();
  if (tn.demo || !tn.firm) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await store().file(tn.firm.id, params.id);
  if (!meta) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (tn.role === "driver") {
    const allowed = meta.tripId ? await driverTrip(store(), tn, meta.tripId) : meta.userId === tn.uid && !!tn.uid;
    if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const f = await readFile(store(), tn.firm.id, params.id);
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(f.bytes), { headers: { "content-type": f.meta.mime, "cache-control": "private, max-age=3600", "content-disposition": `inline; filename="${f.meta.name.replace(/[^\w.-]+/g, "_")}"`, "x-content-type-options": "nosniff" } });
}
