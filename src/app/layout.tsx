import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getPrefs } from "@/lib/prefs";
import { Header } from "@/components/Header";
import { tenant } from "@/lib/tenant";
import { notificationsFor } from "@/lib/notify";
import { blobConfigured } from "@/lib/files";

const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["200", "300", "400", "500", "600"], variable: "--font-inter", display: "swap" });
export const metadata: Metadata = { title: "Querra Fleet", manifest: "/manifest.webmanifest", description: "Querra Fleet: profit pe cursă și economie la motorină pentru flote și utilaje.", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = getPrefs();
  const tn = prefs.role ? await tenant() : null;
  const firm = { name: tn?.role === "admin" ? (tn.firm?.name ?? null) : tn?.firm?.name ?? null, demo: tn?.demo ?? true, demoMode: !!tn?.firm?.demoMode, canToggle: tn?.role === "owner" && !!tn.firm, dbOk: tn?.dbOk ?? true, unread: tn ? (await notificationsFor(tn).catch(() => [])).filter((n) => !n.readAt).length : 0, blobOk: blobConfigured() };
  return (
    <html lang={prefs.loc} data-theme={prefs.theme} className={inter.variable}>
      <body className={prefs.role && prefs.plan === "trial" && !prefs.adminView ? "has-trial" : undefined}>
        <Header prefs={prefs} firm={firm} />
        {children}
      </body>
    </html>
  );
}
