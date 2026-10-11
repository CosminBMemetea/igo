import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?step=3&e=nofirm");
  await store().revokeInvite(f.id, clip((await req.formData()).get("id"), 60));
  return back(req, "/setup?step=3&ok=1");
}
