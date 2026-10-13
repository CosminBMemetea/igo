"use client";
import { usePathname } from "next/navigation";
/** Titlul paginii din antet (mobil). Layout-ul nu se re-randează la navigarea client → titlul vine din pathname-ul curent. */
export function PageTitle({ titles }: { titles: Record<string, string> }) {
  const seg = "/" + ((usePathname() ?? "/").split("/")[1] ?? "");
  const s = titles[seg];
  return s ? <span className="ptitle">{s}</span> : null;
}
