import "./globals.css";
import type { Metadata, Viewport } from "next";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Schnitzery Portal",
  description: "Restaurant staff management",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Schnitzery" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#c0392b",
};

// Inline script runs before paint to apply the saved theme — prevents a flash
// of the wrong colour scheme on load. Sets the `light` class on <html>.
const themeScript = `try{if(localStorage.getItem('sch_theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
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