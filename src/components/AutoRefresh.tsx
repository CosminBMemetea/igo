"use client";
import { useEffect, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
/** Refresh server props, retaining client forms. One timer for both roles, including empty states. */
export function AutoRefresh({ ms = 15000 }: { ms?: number }) {
  const router = useRouter(), path = usePathname();
  const [pending, startTransition] = useTransition();
  const operational = /^\/(?:$|driver(?:\/|$)|feed(?:\/|$)|live(?:\/|$)|trips(?:\/|$)|receipts(?:\/|$)|trucks(?:\/|$)|drivers(?:\/|$)|vehicles(?:\/|$)|documents(?:\/|$)|notifications(?:\/|$))/.test(path);
  useEffect(() => {
    if (!operational) return;
    const tick = () => {
      if (!pending && navigator.onLine && document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const timer = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    window.addEventListener("qf-refresh", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
      window.removeEventListener("qf-refresh", tick);
    };
  }, [router, path, operational, ms, pending]);
  return null;
}
