import { randomUUID } from "node:crypto";
import type { Store } from "./store/types";
export async function notificationJob<T extends { sent?: number; processed?: number; failed?: number; notifications?: number }>(s: Store, name: string, work: () => Promise<T>) {
  const id = randomUUID();
  await s.startNotificationJob(name, id, new Date().toISOString());
  try {
    const r = await work();
    const summary = Object.fromEntries(Object.entries(r).filter((e): e is [string, number] => typeof e[1] === "number"));
    await s.finishNotificationJob(name, id, summary, null); return r;
  } catch (e) { await s.finishNotificationJob(name, id, null, "notification-job-failed").catch(() => {}); throw e; }
}
