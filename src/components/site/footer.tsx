import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "./logo";
import { Container } from "@/components/ui/section";
import { siteConfig, telLink, whatsappLink } from "@/lib/site-config";
import type { Service } from "@/lib/catalog-types";
import { cacheLife } from "next/cache";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function Footer({ services }: { services: Service[] }) {
  const wa = whatsappLink("Hello, I'd like to ask about a cleaning service.");
  return (
    <footer className="mt-24 bg-forest-950 text-sage-200">
      <Container className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo light />
          <p className="max-w-xs text-sm leading-relaxed text-sage-300">{siteConfig.tagline}. Book online or request a quotation.</p>
        </div>
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] !text-brass">Services</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {services.slice(0, 6).map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="hover:text-white">{s.name}</Link>
              </li>
            ))}
            <li><Link href="/services" className="font-semibold text-white">All services →</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] !text-brass">Company</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/gallery" className="hover:text-white">Our work</Link></li>
            <li><Link href="/corporate" className="hover:text-white">Corporate quotes</Link></li>
            <li><Link href="/faqs" className="hover:text-white">FAQs</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms and conditions</Link></li>
            <li><Link href="/cancellation-policy" className="hover:text-white">Cancellation policy</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] !text-brass">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden /><a href={telLink()} className="hover:text-white">{siteConfig.phone}</a></li>
            {wa ? <li className="flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden /><a href={wa} className="hover:text-white" rel="noopener">WhatsApp us</a></li> : null}
            <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden /><a href={`mailto:${siteConfig.email}`} className="break-all hover:text-white">{siteConfig.email}</a></li>
            <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{siteConfig.address}</li>
            <li className="text-sage-300">{siteConfig.hours}</li>
            {(siteConfig.social.instagram || siteConfig.social.facebook || siteConfig.social.x) ? (
              <li className="flex gap-4 pt-1">
                {siteConfig.social.instagram ? <a className="hover:text-white" href={siteConfig.social.instagram} rel="noopener">Instagram</a> : null}
                {siteConfig.social.facebook ? <a className="hover:text-white" href={siteConfig.social.facebook} rel="noopener">Facebook</a> : null}
                {siteConfig.social.x ? <a className="hover:text-white" href={siteConfig.social.x} rel="noopener">X</a> : null}
              </li>
            ) : null}
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-sage-300 sm:flex-row sm:justify-between">
          <p>© <CurrentYear /> {siteConfig.name}. All rights reserved.</p>
          <p>Times shown in West Africa Time (Africa/Lagos).</p>
        </Container>
      </div>
    </footer>
  );
}
