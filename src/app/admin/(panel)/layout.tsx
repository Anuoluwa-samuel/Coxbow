import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminNav, type NavItem } from "@/components/admin/nav";
import { Logo } from "@/components/site/logo";
import { FlashProvider } from "@/components/admin/flash";
import { Button } from "@/components/ui/button";
import { clearSession, getCurrentUser } from "@/server/auth";
import { can, type Permission } from "@/lib/permissions";

const ITEMS: (NavItem & { perm: Permission })[] = [
  { href: "/admin", label: "Overview", perm: "dashboard.view" },
  { href: "/admin/jobs", label: "My jobs", perm: "bookings.read_assigned" },
  { href: "/admin/bookings", label: "Bookings", perm: "bookings.read" },
  { href: "/admin/customers", label: "Customers", perm: "customers.read" },
  { href: "/admin/services", label: "Services", perm: "services.read" },
  { href: "/admin/areas", label: "Areas & hours", perm: "areas.write" },
  { href: "/admin/staff", label: "Staff", perm: "staff.manage" },
  { href: "/admin/payments", label: "Payments", perm: "payments.read" },
  { href: "/admin/reviews", label: "Reviews", perm: "reviews.moderate" },
  { href: "/admin/audit", label: "Audit log", perm: "audit.read" },
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
    <div className="min-h-dvh bg-sand lg:grid lg:grid-cols-[14rem_1fr]">
      <aside className="bg-forest-950 p-4 lg:sticky lg:top-0 lg:h-dvh lg:p-5">
        <div className="mb-4 hidden lg:block"><Logo light /></div>
        <AdminNav items={items} />
        <div className="mt-4 border-t border-white/10 pt-4 text-xs text-sage-300 lg:absolute lg:bottom-5 lg:left-5 lg:right-5">
          <p className="truncate font-semibold text-white">{user.fullName}</p>
          <p className="capitalize">{user.role}</p>
          <form action={logout} className="mt-2"><Button size="sm" variant="outline" className="w-full border-sage-300/40 text-ivory hover:bg-white/10">Sign out</Button></form>
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
