import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import PWARegister from "@/components/PWARegister";
import CookieNotice from "@/components/CookieNotice";
import { Playfair_Display, DM_Sans } from "next/font/google";

// Self-hosted at build time: no visitor IP goes to Google (German GDPR case law) and the CSP stays 'self'.
const display = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-display-src" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-body-src" });

export const metadata: Metadata = {
  title: "Schnitzery Portal",
  description: "Restaurant staff management",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Schnitzery" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#c0392b",
};

// Inline script runs before paint to apply the saved theme — prevents a flash
// of the wrong colour scheme on load. Sets the `light` class on <html>.
const themeScript = `try{if(localStorage.getItem('sch_theme')!=='dark'){document.documentElement.classList.add('light')}}catch(e){document.documentElement.classList.add('light')}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // reflect the chosen language on <html lang> so screen readers and browser
  // translation treat German content as German (the locale is stored in a cookie).
  const lang = (await cookies()).get("lang")?.value === "de" ? "de" : "en";
  return (
    <html lang={lang} translate="no" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning><PWARegister />{children}<CookieNotice /><Analytics /></body>
    </html>
  );
}
