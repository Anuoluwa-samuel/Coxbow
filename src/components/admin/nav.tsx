"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, CreditCard, LayoutDashboard, MapPin, ScrollText, Sparkles, Star, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { overview: LayoutDashboard, jobs: ClipboardList, bookings: CalendarDays, customers: Users, services: Sparkles, areas: MapPin, staff: UserCog, payments: CreditCard, reviews: Star, audit: ScrollText } as const;
export type NavIcon = keyof typeof ICONS;
export interface NavItem { href: string; label: string; icon: NavIcon }

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        const Icon = ICONS[i.icon];
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-sage-200 transition-colors hover:bg-white/10", active && "bg-forest-800 text-white shadow-sm")}
          >
            <Icon className="size-[1.15rem] shrink-0" aria-hidden />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
