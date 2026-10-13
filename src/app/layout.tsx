import { demoResolved } from "@/lib/demo-shift";
import { BSIZE_BOOT } from "@/components/BtnSize";
import { Footer } from "@/components/Footer";
import { WheelX } from "@/components/WheelX";
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
import { DemoTour } from "@/components/DemoTour";
import { tourSteps, tourLabels } from "@/lib/tour";

const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["200", "300", "400", "500", "600"], variable: "--font-inter", display: "swap" });
export const metadata: Metadata = { title: "Querra Fleet", manifest: "/manifest.webmanifest", description: "Querra Fleet: profit pe cursă și economie la motorină pentru flote și utilaje.", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0b0c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = getPrefs();
  const tn = prefs.role ? await tenant() : null;
  const drv = tn?.role === "driver" && tn.firm && tn.uid ? tn.firm.id : null;
  // în paralel: notificări + (pentru șofer) utilizatori și camioane
  const [notes, users, trucks] = await Promise.all([tn ? notificationsFor(tn).catch(() => []) : [], drv ? store().users(drv).catch(() => []) : [], drv ? store().trucks(drv).catch(() => []) : []]);
  const firm = { name: tn?.role === "admin" ? (tn.firm?.name ?? null) : tn?.firm?.name ?? null, demo: tn?.demo ?? true, demoMode: !!tn?.firm?.demoMode, canToggle: tn?.role === "owner" && !!tn.firm, dbOk: tn?.dbOk ?? true, unread: notes.filter((n) => !n.readAt).length, blobOk: blobConfigured() };
  // badge roșu pe „Alerte” (bara mobilă): alerte care cer atenție, minus cele rezolvate în demo
  let alerts = 0;
  if (tn && tn.role !== "driver") { try { const al = await tn.repo.alerts(); const rs = tn.demo ? demoResolved() : {}; alerts = al.filter((a) => (a.theft || a.rule === "doc-expiry") && !(rs as Record<string, unknown>)[(a.theft ? "t-" : "c-") + a.id]).length; } catch {} }
  const me = drv ? users.find((u) => u.id === tn!.uid) : null;
  const plate = me?.truckId ? trucks.find((x) => x.id === me.truckId)?.plate ?? null : null;
  const h = headers();
  const ctx = { ...firm, alerts, who: me?.name ?? null, plate, path: h.get("x-igo-path") ?? "/", denied: h.get("x-igo-denied") };
  return (
    <html suppressHydrationWarning lang={prefs.loc} data-theme={prefs.theme} data-role={lookOf(prefs.role) ?? undefined} className={inter.variable}>
      <head><link rel="preconnect" href="https://server.arcgisonline.com" /><link rel="dns-prefetch" href="https://server.arcgisonline.com" /><script dangerouslySetInnerHTML={{ __html: BSIZE_BOOT }} /></head>
      <body className={prefs.role && prefs.plan === "trial" && !prefs.adminView && !ctx.demo ? "has-trial" : undefined}>
        <Header prefs={prefs} firm={ctx} />
        <WheelX />
        {children}
        {/^\/(live|replay)(\/|$)/.test(ctx.path) ? null : <Footer loc={prefs.loc} />}
        {tn?.demo && prefs.role === "user" ? <DemoTour steps={tourSteps(prefs.loc)} L={tourLabels(prefs.loc)} /> : null}
      </body>
    </html>
  );
}
