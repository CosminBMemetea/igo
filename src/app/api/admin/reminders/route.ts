import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { runReminders } from "@/lib/reminders";
export const dynamic = "force-dynamic";
/** Admin: rulează acum jobul de reamintiri (idempotent). */
export async function POST(req: Request) {
  const r = await runReminders(store());
  return back(req, `/admin?rem=${r.notifications}-${r.emails.sent}-${r.emails.queued}-${r.emails.failed}`);
}
