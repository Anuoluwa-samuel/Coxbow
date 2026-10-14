import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, CalendarDays, CheckCircle2, ClipboardList, FileText, HandCoins, Users, UserCheck, Wallet, XCircle } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db/client";
import { dashboardPanels, dashboardStats, listBookings } from "@/server/admin-queries";
import { Card, PageTitle, Stat, StatusBadge } from "@/components/admin/ui";
import { BarChart } from "@/components/admin/bar-chart";
import { formatNaira } from "@/lib/money";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "dashboard.view")) redirect("/admin/jobs");
  const [s, p, recent] = await Promise.all([dashboardStats(db), dashboardPanels(db), listBookings(db, {})]);
  const first = user.fullName.split(" ")[0];
  return (
    <>
      <PageTitle title="Dashboard" sub={`Welcome back, ${first}. Here is what is happening with your cleaning business. Figures are live from the database; revenue counts verified payments only.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total bookings" value={p.totalBookings} hint="All time" icon={CalendarDays} tone="green" />
        <Stat label="Revenue (verified)" value={formatNaira(s.revenueKobo)} hint="Net of refunds" icon={Wallet} tone="sky" />
        <Stat label="Customers" value={p.customers} hint="All time" icon={Users} tone="violet" />
        <Stat label="Active cleaners" value={p.activeStaff} icon={UserCheck} tone="peach" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="New requests" value={s.newRequests} hint="Awaiting review" icon={ClipboardList} size="sm" />
        <Stat label="Pending quotations" value={s.pendingQuotations} hint="Sent, awaiting customer" icon={FileText} size="sm" />
        <Stat label="Confirmed bookings" value={s.confirmed} icon={CheckCircle2} size="sm" />
        <Stat label="Today's jobs" value={s.todayJobs} hint="Lagos time" icon={CalendarCheck} size="sm" />
        <Stat label="Completed" value={s.completed} icon={CheckCircle2} size="sm" />
        <Stat label="Cancelled / rejected" value={s.cancelled} icon={XCircle} size="sm" />
        <Stat label="Outstanding" value={formatNaira(s.outstandingKobo)} hint="Agreed price not yet paid" icon={HandCoins} size="sm" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
        <Card title="Upcoming bookings">
          {p.upcoming.length === 0 ? <p className="text-sm text-ink-soft">No confirmed or scheduled jobs coming up.</p> : (
            <ul className="divide-y divide-line">
              {p.upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/bookings/${b.id}`} className="font-bold text-forest-950 hover:underline">{b.service}</Link>
                    <p className="truncate text-xs text-ink-mute">{b.customer} · {b.date} · {b.slot}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/bookings" className="mt-3 inline-block text-sm font-bold text-forest-800 hover:underline">View all bookings →</Link>
        </Card>

        <Card title="Revenue overview">
          <p className="mb-3 text-xs text-ink-mute">Verified payments received per 7-day period</p>
          <BarChart data={p.weeks} caption="Verified payments received in each of the last four 7-day periods" />
        </Card>

        <Card title="Recent customers">
          {p.recent.length === 0 ? <p className="text-sm text-ink-soft">No customers yet.</p> : (
            <ul className="divide-y divide-line">
              {p.recent.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-200 text-sm font-bold text-forest-900">{c.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0"><Link href={`/admin/customers/${c.id}`} className="font-bold text-forest-950 hover:underline">{c.name}</Link><p className="truncate text-xs text-ink-mute">{c.phone}</p></div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/customers" className="mt-3 inline-block text-sm font-bold text-forest-800 hover:underline">View all customers →</Link>
        </Card>
      </div>

      <Card title="Latest requests" className="mt-6">
        {recent.rows.length === 0 ? <p className="text-sm text-ink-soft">No bookings yet.</p> : (
          <ul className="divide-y divide-line">
            {recent.rows.slice(0, 6).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><Link className="font-bold text-forest-800 underline" href={`/admin/bookings/${r.id}`}>{r.reference}</Link> <span className="text-ink-soft">· {r.customer} · {r.service} · {r.scheduledDate}</span></span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
