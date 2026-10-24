// Server: tura curentă pentru bara de jos de pe Curse / Acte / Profil (date proaspete la fiecare navigare).
import { tenant } from "@/lib/tenant";
import { getPrefs } from "@/lib/prefs";
import { t } from "@/lib/i18n";
import { driverView } from "@/lib/driver-view";
import { currentShift } from "@/lib/driver-shift";
import { RemoteShiftBar } from "./DriverShiftBar";

export async function DriverShiftDock() {
  const tn = await tenant(), { loc } = await getPrefs();
  if (!tn.role) return null;
  const dv = await driverView(tn).catch(() => null);
  const v = dv?.vehicle;
  if (!v) return null;
  const nowMs = Date.now();
  const shift = await currentShift(tn, v.id, nowMs).catch(() => null);
  const labels = { start: t(loc, "drv.start"), stop: t(loc, "drv.stop"), endQ: t(loc, "drv.endQ"), endTxt: t(loc, "drv.endTxt"), endYes: t(loc, "drv.endYes"), endNo: t(loc, "drv.endNo") };
  return <RemoteShiftBar vehicleId={v.id} initial={shift && !shift.end ? { start: shift.start, priv: !!shift.privateSince } : null} serverNow={nowMs} loc={loc} labels={labels} preview={tn.role !== "driver"} demo={tn.demo} />;
}
