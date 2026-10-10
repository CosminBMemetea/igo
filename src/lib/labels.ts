import { t, type Locale, type MsgKey } from "./i18n";
/** Etichetele pentru harta client (subset din catalog). */
export function mapLabels(loc: Locale): Record<string, string> {
  const k: [string, MsgKey][] = [["f.all", "live.all"], ["f.truck", "live.trucks"], ["f.agri", "live.agri"], ["f.van", "live.vans"], ["replay", "live.replay"], ["driver", "live.driver"], ["today", "live.today"], ["profitToday", "live.profitToday"], ["zones", "live.zones"], ["left", "live.left"], ["entry", "live.entry"], ["exit", "live.exit"], ["open", "live.open"], ["noZones", "live.noZones"], ["tiles", "live.tiles"], ["trip", "trip.detail"], ["ago.s", "ago.s"], ["ago.m", "ago.m"], ["kind.truck", "kind.truck"], ["kind.agri", "kind.agri"], ["kind.van", "kind.van"], ["st.moving", "st.moving"], ["st.stopped", "st.stopped"], ["st.pump", "st.pump"], ["st.working", "st.working"], ["st.offline", "st.offline"]];
  return Object.fromEntries(k.map(([a, b]) => [a, t(loc, b)]));
}
