import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} | Cleaning services in Nigeria`, template: `%s | ${siteConfig.name}` },
  description: "Book home and office cleaning or request a quotation online. Clear scope, honest pricing guidance and scheduled visits.",
  openGraph: { type: "website", siteName: siteConfig.name, locale: "en_NG" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#faf7f0", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${fraunces.variable} ${figtree.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
