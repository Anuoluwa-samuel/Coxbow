import { Suspense } from "react";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Logo } from "@/components/site/logo";
import { DemoBanner } from "@/components/site/demo-banner";
import { listServices } from "@/server/catalog";
import { siteConfig, telLink } from "@/lib/site-config";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const services = await listServices();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-forest-900 focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <DemoBanner />
      <Suspense
        fallback={
          <header className="sticky top-0 z-40 h-16 border-b border-line/80 bg-ivory">
            <div className="mx-auto flex h-full max-w-6xl items-center px-4 sm:px-6 lg:px-8"><Logo /></div>
          </header>
        }
      >
        <Header phone={siteConfig.phone} telHref={telLink()} />
      </Suspense>
      <main id="main">{children}</main>
      <Footer services={services} />
    </>
  );
}
