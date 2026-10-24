import { countTri, tri, type Locale } from "@/lib/i18n";
import type { driverProgress } from "@/lib/driver-progress";
export function DriverProgress({ progress: p, loc }: { progress: ReturnType<typeof driverProgress>; loc: Locale }) {
  return <section className="sheet section"><h2>{tri(loc, "Progresul meu|My progress|Moje postępy")}</h2>
    <p><strong>{countTri(loc, p.completed, "livrare/livrări/de livrări|delivery/deliveries|dostawa/dostawy/dostaw")}</strong> {tri(loc, "cu POD în ultimele 30 de zile|with POD in the last 30 days|z POD w ostatnich 30 dniach")}</p>
    <p>{p.rank ? tri(loc, `Locul ${p.rank} din ${countTri("ro", p.participants, "șofer/șoferi/de șoferi")} cu livrări documentate|Rank ${p.rank} of ${countTri("en", p.participants, "driver/drivers")} with documented deliveries|Miejsce ${p.rank} z ${p.participants} kierowców z udokumentowanymi dostawami`) : p.participants < 3 ? tri(loc, "Clasamentul apare când cel puțin 3 șoferi au livrări documentate în această perioadă.|Rankings appear when at least 3 drivers have documented deliveries in this period.|Ranking pojawia się, gdy co najmniej 3 kierowców ma udokumentowane dostawy w tym okresie.") : tri(loc, "O livrare cu POD în această perioadă te include în clasament.|A delivery with POD in this period includes you in the ranking.|Dostawa z POD w tym okresie uwzględni Cię w rankingu.")}</p>
    <div className="invrow">{p.badges.map(b => <span className="badge ok" key={b.count}>★ {b.count} POD</span>)}</div>
    <p className="hint">{tri(loc, "Distincții de activitate, fără valoare în bani. Nu reprezintă un scor de siguranță; volumul curselor depinde și de alocările firmei.|Activity badges, without cash value. Not a safety score; trip volume also depends on company assignments.|Odznaki aktywności bez wartości pieniężnej. To nie ocena bezpieczeństwa; liczba kursów zależy też od przydziałów firmy.")}</p>
  </section>;
}
