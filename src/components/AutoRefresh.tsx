"use client";
import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
const LIVE = /^\/(?:$|driver(?:\/|$)|feed(?:\/|$)|live(?:\/|$))/;
const SLOW = /^\/(?:trips|receipts|trucks|drivers|vehicles|documents|notifications)(?:\/|$)/;
/** While the user types or has a sheet/menu open, a refresh would only cost a server render. */
const editing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || !!document.querySelector("dialog[open], details[open] form, details.acct[open]"); };
/** Refresh server props, retaining client forms. Live pages every 15 s, list pages every 60 s; never while hidden, offline, editing or already refreshing. */
export function AutoRefresh({ ms = 15000 }: { ms?: number }) {
  const router = useRouter(), path = usePathname();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false), last = useRef(0);
  useEffect(() => { busy.current = pending; }, [pending]);
  const every = LIVE.test(path) ? ms : SLOW.test(path) ? ms * 4 : 0;
  useEffect(() => {
    if (!every) return;
    last.current = Date.now();
    const run = (force: boolean) => {
      if (busy.current || !navigator.onLine || document.visibilityState !== "visible") return;
      if (!force && (Date.now() - last.current < every - 500 || editing())) return;
      last.current = Date.now(); startTransition(() => router.refresh());
    };
    const tick = () => run(false), now = () => run(true);
    const timer = setInterval(tick, every);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    window.addEventListener("qf-refresh", now);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
      window.removeEventListener("qf-refresh", now);
    };
  }, [router, path, every]);
  return null;
}
