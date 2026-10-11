import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
export const dynamic = "force-dynamic";
/** „Import CSV card carburant” vine mai târziu: deocamdată marcăm pasul 5 ca amânat. */
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?e=nofirm");
  await store().updateFirm(f.id, { csvSkipped: true });
  return back(req, "/");
}
