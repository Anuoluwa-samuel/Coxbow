"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { Logo } from "./logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/services", label: "Services" },
  { href: "/corporate", label: "Corporate" },
  { href: "/gallery", label: "Our work" },
  { href: "/about", label: "About" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

export function Header({ phone, telHref }: { phone: string; telHref: string }) {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-soft transition-colors hover:text-forest-900",
                  active && "text-forest-900 underline decoration-brass decoration-2 underline-offset-8",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <a href={telHref} className="hidden items-center gap-2 px-2 text-sm font-semibold text-forest-900 xl:inline-flex">
            <Phone className="size-4" aria-hidden /> {phone}
          </a>
          <ButtonLink href="/book" size="md" className="hidden sm:inline-flex">
            Book a clean
          </ButtonLink>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-forest-900 hover:bg-forest-800/5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-menu" aria-label="Mobile" className="border-t border-line bg-ivory px-4 pb-6 pt-2 lg:hidden">
          <ul className="divide-y divide-line">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block py-3.5 text-lg font-medium text-forest-950">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink href="/book" size="lg" className="mt-4 w-full">
            Book a clean
          </ButtonLink>
          <a href={telHref} className="mt-3 block text-center text-sm font-semibold text-forest-900">
            Call {phone}
          </a>
        </nav>
      ) : null}
    </header>
  );
}
