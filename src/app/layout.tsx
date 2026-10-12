import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getPrefs } from "@/lib/prefs";
import { Header } from "@/components/Header";
import { tenant } from "@/lib/tenant";
import { notificationsFor } from "@/lib/notify";
import { blobConfigured } from "@/lib/files";
import { headers } from "next/headers";
import { store } from "@/lib/store";
import { lookOf } from "@/lib/roles";

const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["200", "300", "400", "500", "600"], variable: "--font-inter", display: "swap" });
export const metadata: Metadata = { title: "Querra Fleet", manifest: "/manifest.webmanifest", description: "Querra Fleet: profit pe cursă și economie la motorină pentru flote și utilaje.", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = getPrefs();
  const tn = prefs.role ? await tenant() : null;
  const firm = { name: tn?.role === "admin" ? (tn.firm?.name ?? null) : tn?.firm?.name ?? null, demo: tn?.demo ?? true, demoMode: !!tn?.firm?.demoMode, canToggle: tn?.role === "owner" && !!tn.firm, dbOk: tn?.dbOk ?? true, unread: tn ? (await notificationsFor(tn).catch(() => [])).filter((n) => !n.readAt).length : 0, blobOk: blobConfigured() };
  const me = tn?.role === "driver" && tn.firm && tn.uid ? (await store().users(tn.firm.id).catch(() => [])).find((u) => u.id === tn.uid) : null;
  const plate = me?.truckId && tn?.firm ? (await store().trucks(tn.firm.id).catch(() => [])).find((x) => x.id === me.truckId)?.plate ?? null : null;
  const h = headers();
  const ctx = { ...firm, who: me?.name ?? null, plate, path: h.get("x-igo-path") ?? "/", denied: h.get("x-igo-denied") };
  return (
    <html lang={prefs.loc} data-theme={prefs.theme} data-role={lookOf(prefs.role) ?? undefined} className={inter.variable}>
      <body className={prefs.role && prefs.plan === "trial" && !prefs.adminView ? "has-trial" : undefined}>
        <Header prefs={prefs} firm={ctx} />
        {children}
      </body>
    </html>
  );
}
