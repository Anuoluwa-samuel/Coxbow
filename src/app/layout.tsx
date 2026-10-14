import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { DemoBanner } from "@/components/site/demo-banner";
import { listServices } from "@/server/catalog";
import { siteConfig, telLink } from "@/lib/site-config";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const services = await listServices();
  return (
    <html lang="en-NG" className={`${fraunces.variable} ${figtree.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-forest-900 focus:px-4 focus:py-2 focus:text-ivory">
          Skip to content
        </a>
        <DemoBanner />
        <Header phone={siteConfig.phone} telHref={telLink()} />
        <main id="main">{children}</main>
        <Footer services={services} />
      </body>
    </html>
  );
}
