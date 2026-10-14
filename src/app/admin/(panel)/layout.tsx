import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminNav, type NavItem } from "@/components/admin/nav";
import { Logo } from "@/components/site/logo";
import { FlashProvider } from "@/components/admin/flash";
import { Button } from "@/components/ui/button";
import { clearSession, getCurrentUser } from "@/server/auth";
import { can, type Permission } from "@/lib/permissions";

const ITEMS: (NavItem & { perm: Permission })[] = [
  { href: "/admin", label: "Dashboard", icon: "overview", perm: "dashboard.view" },
  { href: "/admin/jobs", label: "My jobs", icon: "jobs", perm: "bookings.read_assigned" },
  { href: "/admin/bookings", label: "Bookings", icon: "bookings", perm: "bookings.read" },
  { href: "/admin/customers", label: "Customers", icon: "customers", perm: "customers.read" },
  { href: "/admin/services", label: "Services", icon: "services", perm: "services.read" },
  { href: "/admin/areas", label: "Areas & hours", icon: "areas", perm: "areas.write" },
  { href: "/admin/staff", label: "Cleaning staff", icon: "staff", perm: "staff.manage" },
  { href: "/admin/payments", label: "Payments", icon: "payments", perm: "payments.read" },
  { href: "/admin/reviews", label: "Reviews", icon: "reviews", perm: "reviews.moderate" },
  { href: "/admin/audit", label: "Audit log", icon: "audit", perm: "audit.read" },
];

async function logout() {
  "use server";
  await clearSession();
  redirect("/admin/login");
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const items = ITEMS.filter((i) => can(user.role, i.perm));
  return (
    <div className="min-h-dvh bg-ivory lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="bg-forest-950 p-4 lg:sticky lg:top-0 lg:h-dvh lg:rounded-r-[1.75rem] lg:p-5">
        <div className="mb-4 hidden lg:block"><Logo light /></div>
        <AdminNav items={items} />
        <div className="mt-4 border-t border-white/10 pt-4 text-xs text-sage-300 lg:absolute lg:bottom-5 lg:left-5 lg:right-5">
          <div className="flex items-center gap-2.5"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-800 text-sm font-bold text-white">{user.fullName.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-semibold text-white">{user.fullName}</p><p className="capitalize">{user.role}</p></div></div>
          <form action={logout} className="mt-2"><Button size="sm" variant="outline" className="w-full border-sage-300/40 bg-transparent text-white hover:bg-white/10">Sign out</Button></form>
        </div>
      </aside>
      <div className="min-w-0 p-4 sm:p-6 lg:p-8"><FlashProvider>{children}</FlashProvider></div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p role="status" className="p-10 text-center text-ink-mute">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
