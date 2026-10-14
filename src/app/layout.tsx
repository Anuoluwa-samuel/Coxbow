import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} | Cleaning services in Nigeria`, template: `%s | ${siteConfig.name}` },
  description: "Book home and office cleaning or request a quotation online. Clear scope, honest pricing guidance and scheduled visits.",
  openGraph: { type: "website", siteName: siteConfig.name, locale: "en_NG" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#f4faf7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
