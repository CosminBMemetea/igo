"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const ITEMS: [IconName, string, boolean][] = [["home", "/", false], ["live", "/live", false], ["trips", "/trips", false], ["alerts", "/alerts", false], ["crm", "/crm", true], ["docs", "/documents", true], ["receipts", "/receipts", true], ["invoices", "/invoices", true], ["driver", "/driver", true], ["features", "/features", false]];
export function NavIcons({ labels }: { labels: Record<string, string> }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h) || (h === "/trips" && path.startsWith("/vehicles")) || (h === "/features" && path.startsWith("/plans")));
  return (
    <nav className="nav">
      {ITEMS.map(([k, h, m]) => <Link key={k} href={h} className={`ico${on(h) ? " on" : ""}${m ? " mhide" : ""}`} title={labels[k]} aria-label={labels[k]}><Icon name={k} /></Link>)}
    </nav>
  );
}
