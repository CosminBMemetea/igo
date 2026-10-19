import { driverTrip } from "@/lib/driver-access";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
import { saveFile, MAX_FILE_BYTES } from "@/lib/files";
import { clip } from "@/lib/validate";
import { operationCode, reportOperationFailure } from "@/lib/operation-error";
export const dynamic = "force-dynamic";
/** Poze CMR/POD de la șofer (sau proprietar), legate de o cursă a firmei. Comprimate în telefon; max 2 MB. */
export async function POST(req: Request) {
  const tn = await tenant();
  if (tn.demo || !tn.firm) return NextResponse.json({ demo: true }, { status: 200 });
  if (tn.role !== "owner" && tn.role !== "driver" && tn.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: "size" }, { status: 413 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file"), kind = fd?.get("kind"), tripId = clip(fd?.get("tripId") ?? null, 60);
  if (!(file instanceof File) || !tripId || (kind !== "pod" && kind !== "cmr")) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const s = store();
  try {
    if (!(await driverTrip(s, tn, tripId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const m = await saveFile(s, tn.firm.id, { kind, tripId, name: file.name || `${kind}.jpg`, mime: file.type, bytes: Buffer.from(await file.arrayBuffer()), userId: tn.uid });
    return NextResponse.json({ id: m.id, size: m.size });
  } catch (e) {
    const code = operationCode(e);
    if (code) return NextResponse.json({ error: code }, { status: code === "size" ? 413 : code === "type" || code === "empty" ? 415 : (code === "trip-closed" || code === "assignment") ? 409 : 404 });
    return NextResponse.json({ error: "upload-unavailable", reference: reportOperationFailure("trip-upload", e) }, { status: 503 });
  }
}
