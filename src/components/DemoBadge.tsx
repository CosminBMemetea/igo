import { tri, type Locale } from "@/lib/i18n";
/** Permanent marker on demo screens: every number shown is fictitious. */
export function DemoBadge({ loc, floating }: { loc: Locale; floating?: boolean }) {
  return <span className={`badge warn demo-badge${floating ? " float" : ""}`} role="note">{tri(loc, "Date fictive|Fictitious data|Dane fikcyjne")}</span>;
}
