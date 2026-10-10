import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getPrefs } from "@/lib/prefs";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin", "latin-ext"], weight: ["200", "300", "400", "500", "600"], variable: "--font-inter", display: "swap" });
export const metadata: Metadata = { title: "igo", description: "igo: profit pe cursă și economie la motorină pentru flote și utilaje.", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b0c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = getPrefs();
  return (
    <html lang={prefs.loc} data-theme={prefs.theme} className={inter.variable}>
      <body className={prefs.role && prefs.plan === "trial" && !prefs.adminView ? "has-trial" : undefined}>
        <Header prefs={prefs} />
        {children}
      </body>
    </html>
  );
}
