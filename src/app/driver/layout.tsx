import { DriverTabBar } from "@/components/DriverTabBar";
import { tenant } from "@/lib/tenant";
import { getPrefs } from "@/lib/prefs";
import { tri } from "@/lib/i18n";
import { driverView } from "@/lib/driver-view";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const tn = await tenant(), { loc } = await getPrefs();
  // fără firmă/demo nu există date de șofer; pagina afișează propriul mesaj
  const todo = tn.role ? await driverView(tn).then(v => v.todo).catch(() => 0) : 0;
  return <div className="dshell">
    {children}
    <DriverTabBar label={tri(loc, "Meniu șofer|Driver menu|Menu kierowcy")} tabs={[
      { href: "/driver", icon: "home", label: tri(loc, "Acasă|Home|Start") },
      { href: "/driver/trips", icon: "trips", label: tri(loc, "Curse|Trips|Kursy") },
      { href: "/driver/docs", icon: "docs", label: tri(loc, "Acte|Docs|Dokumenty"), badge: todo },
      { href: "/driver/profile", icon: "user", label: tri(loc, "Profil|Profile|Profil") },
    ]} />
  </div>;
}
