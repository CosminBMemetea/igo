import type { ComplianceState } from "./compliance";
export const COMPLIANCE_LABELS: Record<ComplianceState, string> = {
  valid: "În termen · declarat|In date · declared|W terminie · deklaracja",
  soon: "Expiră curând|Expiring soon|Wkrótce wygasa", urgent: "Expiră în ≤ 7 zile|Expires in ≤ 7 days|Wygasa za ≤ 7 dni",
  expired: "Expirat|Expired|Wygasły", missing: "Lipsește din evidență|Missing from records|Brak w ewidencji",
  unknown: "De verificat|Needs checking|Do sprawdzenia", future: "Nu a început încă|Not yet active|Jeszcze nieważny",
  "not-applicable": "Nu se aplică|Not applicable|Nie dotyczy",
};
export const complianceBadge = (s: ComplianceState) => s === "valid" ? "ok" : ["expired", "missing", "urgent", "future"].includes(s) ? "bad" : s === "not-applicable" ? "" : "warn";
