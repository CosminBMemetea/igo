import { driverTrip } from "@/lib/driver-access";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
import { readFile } from "@/lib/files";
export const dynamic = "force-dynamic";
/** Servește fișierul doar dacă aparține firmei sesiunii (și pentru Blob trece prin server: URL-ul nu ajunge la client). */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tn = await tenant();
  if (tn.demo || !tn.firm) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await store().file(tn.firm.id, params.id);
  if (!meta) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (tn.role === "driver") {
    let allowed: unknown = meta.tripId ? await driverTrip(store(), tn, meta.tripId) : meta.userId === tn.uid && !!tn.uid;
    if (meta.docId) {
      const s = store(), [docs, me, trucks] = await Promise.all([s.docs(tn.firm.id), tn.uid ? s.userById(tn.uid) : null, s.trucks(tn.firm.id)]);
      const doc = docs.find(d => d.id === meta.docId && d.fileId === meta.id);
      allowed = !!doc && !!me && !me.disabledAt && (doc.userId === me.id || (!!doc.truckId && doc.truckId === me.truckId && trucks.some(t => t.id === doc.truckId && !t.archivedAt)));
    }
    if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const f = await readFile(store(), tn.firm.id, params.id);
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(f.bytes), { headers: { "content-type": f.meta.mime, "cache-control": "private, no-store", "content-disposition": `inline; filename="${f.meta.name.replace(/[^\w.-]+/g, "_")}"`, "x-content-type-options": "nosniff" } });
}
