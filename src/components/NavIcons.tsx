"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const ITEMS: [IconName, string, boolean][] = [["home", "/", false], ["live", "/live", false], ["trips", "/trips", false], ["alerts", "/alerts", false], ["crm", "/crm", true], ["docs", "/documents", true], ["receipts", "/receipts", true], ["invoices", "/invoices", true], ["driver", "/driver", true], ["ranking", "/ranking", true], ["features", "/features", false]];
// demo: doar esențialul pentru o firmă de transport
const DEMO: [IconName, string, boolean][] = [["home", "/", false], ["live", "/live", false], ["trips", "/trips", false], ["alerts", "/alerts", false], ["docs", "/documents", true], ["receipts", "/receipts", true], ["upload", "/import", true], ["driver", "/driver", true], ["ranking", "/ranking", true], ["savings", "/savings", false]];
export function NavIcons({ labels, demo }: { labels: Record<string, string>; demo?: boolean }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h) || (h === "/trips" && path.startsWith("/vehicles")) || (h === "/features" && path.startsWith("/plans")) || (h === "/import" && path.startsWith("/import")));
  return (
    <nav className="nav">
      {(demo ? DEMO : ITEMS).map(([k, h, m]) => <Link key={k} href={h} className={`ico${on(h) ? " on" : ""}${m ? " mhide" : ""}`} title={labels[k === "upload" ? "import" : k]} aria-label={labels[k === "upload" ? "import" : k]}><Icon name={k} /></Link>)}
    </nav>
  );
}
