import { appOrigin } from "./app-origin";
import { queuePush, queueTaskAlerts } from "./alert-delivery";
import { reminderDocuments } from "./compliance-reminders";
// Querra Fleet: jobul zilnic de reamintiri (Vercel Cron ~06:00 Europe/Bucharest). Idempotent: chei unice pe notificări și emailuri.
import { dueReminders, type RDoc } from "./docs";
import { queueEmail, emailProvider, type EmailProvider } from "./email";
import { DEFAULT_LOCALE, t, type Locale, type MsgKey } from "./i18n";
import type { Store } from "./store/types";
import { localNow } from "./validate";

export async function runReminders(s: Store, today = localNow().slice(0, 10), p: EmailProvider | null = emailProvider(), loc: Locale = DEFAULT_LOCALE, options: { defer?: boolean } = {}) {
  const res = { firms: 0, notifications: 0, emails: { sent: 0, queued: 0, failed: 0 } };
  for (const f of await s.firms()) {
    const [docs, users, trucks] = await Promise.all([s.docs(f.id), s.users(f.id), s.trucks(f.id)]);
    await queueTaskAlerts(s, f.id, p);
    if (!docs.length) continue;
    res.firms++;
    const label = (d: (typeof docs)[number]) => (d.userId ? users.find((u) => u.id === d.userId)?.name ?? "—" : trucks.find((x) => x.id === d.truckId)?.plate ?? "—");
    const rdocs: RDoc[] = reminderDocuments(docs, trucks, users, today).map((d) => ({ id: d.id, type: d.type, expires: d.expires, truckId: d.truckId, userId: d.userId ?? null, label: label(d) }));
    const due = dueReminders(rdocs, users.filter(u => !u.disabledAt).map((u) => ({ id: u.id, role: u.role, email: u.email, truckId: u.truckId })), today);
    const byDoc = new Map(rdocs.map((d) => [d.id, d]));
    const added = await s.addNotifications(f.id, due.filter((r) => !r.email).map((r) => ({ userId: r.userId, key: r.key, kind: r.stage, docId: r.docId, params: { type: byDoc.get(r.docId)!.type, label: byDoc.get(r.docId)!.label, expires: byDoc.get(r.docId)!.expires, days: r.days } })));
    res.notifications += added.length;
    for (const r of due.filter(x => !x.email)) {
      const d = byDoc.get(r.docId)!;
      for (const user of users.filter(u => !u.disabledAt && (r.userId ? u.id === r.userId : u.role === "owner")))
        await queuePush(s, f.id, user, `${r.key}:${user.id}`, { kind: "document", userId: user.id, docId: d.id, expires: d.expires, stage: r.stage });
    }
    for (const r of due.filter((x) => x.email)) {
      const user = users.find(u => u.id === r.userId);
      if (!user || user.emailAlerts === false) continue;
      const locale = (["ro", "en", "pl"].includes(user.locale ?? "") ? user.locale : loc) as Locale;
      const d = byDoc.get(r.docId)!, doc = t(locale, `doc.${d.type}` as MsgKey);
      const subject = `${doc} · ${d.label} · ${d.expires}`;
      const text = t(locale, "mail.body", { firm: f.name, doc, label: d.label, expires: d.expires, asOf: today, url: `${appOrigin()}/notifications` });
      const st = await queueEmail(s, f.id, r.key, { to: r.email!, subject, text }, p, { context: { kind: "document", userId: user.id, docId: d.id, expires: d.expires, stage: r.stage }, defer: options.defer, today });
      if (st) res.emails[st]++;
    }
  }
  return res;
}
