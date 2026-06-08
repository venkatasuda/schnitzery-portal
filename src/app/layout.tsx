import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schnitzery Portal",
  description: "Restaurant staff management",
};

// Inline script runs before paint to apply the saved theme — prevents a flash
// of the wrong colour scheme on load. Sets the `light` class on <html>.
const themeScript = `try{if(localStorage.getItem('sch_theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}