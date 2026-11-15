import { drainDeliveries } from "@/lib/delivery";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { runReminders } from "@/lib/reminders";
import { DEFAULT_LOCALE } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Admin: rulează acum jobul de reamintiri (idempotent). */
export async function POST(req: Request) {
  const r = await runReminders(store(), undefined, null, DEFAULT_LOCALE, { defer: true });
  await drainDeliveries(store());
  return back(req, `/admin?rem=${r.notifications}-${r.emails.sent}-${r.emails.queued}-${r.emails.failed}`);
}
