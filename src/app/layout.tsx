import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import PWARegister from "@/components/PWARegister";

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
const themeScript = `try{if(localStorage.getItem('sch_theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // reflect the chosen language on <html lang> so screen readers and browser
  // translation treat German content as German (the locale is stored in a cookie).
  const lang = (await cookies()).get("lang")?.value === "de" ? "de" : "en";
  return (
    <html lang={lang} translate="no" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning><PWARegister />{children}</body>
    </html>
  );
}