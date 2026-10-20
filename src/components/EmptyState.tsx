import Link from "next/link";
import { t, type Locale, type MsgKey } from "@/lib/i18n";

export type EmptyKind = "home" | "live" | "trips" | "alerts" | "crm" | "docs" | "invoices" | "receipts" | "driver" | "driverOwner";
const CFG: Record<EmptyKind, { href: string | null; icon: string }> = {
  home: { href: "/setup?step=5", icon: "M4 17l5-5 4 4 7-7M14 9h6v6" },
  live: { href: "/setup?step=3", icon: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  trips: { href: "/setup?step=5", icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  alerts: { href: "/import", icon: "M12 3l9 16H3zM12 10v4M12 17h.01" },
  crm: { href: "/setup?step=5", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  docs: { href: "/setup?step=4", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  invoices: { href: "/setup?step=5", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  receipts: { href: "/setup?step=3", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h4" },
  driver: { href: null, icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7" },
  driverOwner: { href: "/setup?step=2", icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7" },
};
/** Ecran gol care spune ce va apărea aici și are un singur buton cu pasul următor. */
/** hideCta: the page renders its own single primary action below. */
export function EmptyState({ kind, loc, canSetup = true, hideCta }: { kind: EmptyKind; loc: Locale; canSetup?: boolean; hideCta?: boolean }) {
  const c = CFG[kind];
  return (
    <div className="empty fade">
      <span className="ill"><svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg></span>
      <h2>{t(loc, `empty.${kind}.title` as MsgKey)}</h2>
      <p>{t(loc, `empty.${kind}.text` as MsgKey)}</p>
      {hideCta ? null : c.href && canSetup ? <Link className="btn pri" href={c.href}>{t(loc, `empty.${kind}.cta` as MsgKey)}</Link> : !canSetup ? <p style={{ fontSize: 13 }}>{t(loc, "empty.askOwner")}</p> : null}
    </div>
  );
}
