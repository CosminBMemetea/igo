import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { tenant } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const tn = await tenant();
  if (!tn.demo && tn.firm) await store().markRead(tn.firm.id, tn.role === "driver" ? tn.uid : null);
  return back(req, "/notifications");
}
