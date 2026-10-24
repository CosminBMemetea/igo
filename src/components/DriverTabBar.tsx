"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

type Tab = { href: string; icon: "home" | "trips" | "docs" | "user"; label: string; badge?: number };
/** Bara de jos a șoferului: 4 butoane mari, mereu la îndemâna degetului mare. */
export function DriverTabBar({ tabs, label }: { tabs: Tab[]; label: string }) {
  const path = usePathname() ?? "/driver";
  const on = (h: string) => h === "/driver" ? path === "/driver" : path.startsWith(h);
  return <nav className="dtabs" aria-label={label}>
    {tabs.map(t => <Link key={t.href} href={t.href} prefetch className={`dtab${on(t.href) ? " on" : ""}`} aria-current={on(t.href) ? "page" : undefined}>
      <span className="dtab-ic"><Icon name={t.icon} size={24} />{t.badge ? <b className="dtab-badge" aria-label={String(t.badge)}>{t.badge > 9 ? "9+" : t.badge}</b> : null}</span>
      <span className="dtab-l">{t.label}</span>
    </Link>)}
  </nav>;
}
