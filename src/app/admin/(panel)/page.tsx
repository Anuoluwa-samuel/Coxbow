import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db/client";
import { dashboardStats, listBookings } from "@/server/admin-queries";
import { Card, PageTitle, Stat, StatusBadge, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { formatNaira } from "@/lib/money";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Overview", robots: { index: false } };

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!can(user.role, "dashboard.view")) redirect("/admin/jobs");
  const [s, recent] = await Promise.all([dashboardStats(db), listBookings(db, {})]);
  return (
    <>
      <PageTitle title="Overview" sub="Live figures from the database. Revenue counts verified payments only." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="New requests" value={s.newRequests} hint="Awaiting review" />
        <Stat label="Pending quotations" value={s.pendingQuotations} hint="Sent, awaiting customer" />
        <Stat label="Confirmed bookings" value={s.confirmed} />
        <Stat label="Today's jobs" value={s.todayJobs} hint="Lagos time" />
        <Stat label="Completed" value={s.completed} />
        <Stat label="Cancelled / rejected" value={s.cancelled} />
        <Stat label="Revenue (verified)" value={formatNaira(s.revenueKobo)} hint="Net of refunds" />
        <Stat label="Outstanding" value={formatNaira(s.outstandingKobo)} hint="Agreed price not yet paid" />
      </div>
      <Card title="Latest requests" className="mt-8">
        {recent.rows.length === 0 ? <p className="text-sm text-ink-soft">No bookings yet.</p> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr><th className={thCls}>Reference</th><th className={thCls}>Customer</th><th className={thCls}>Service</th><th className={thCls}>Date</th><th className={thCls}>Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {recent.rows.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td className={tdCls}><Link className="font-semibold text-forest-800 underline" href={`/admin/bookings/${r.id}`}>{r.reference}</Link></td>
                    <td className={tdCls}>{r.customer}</td><td className={tdCls}>{r.service}</td><td className={tdCls}>{r.scheduledDate}</td>
                    <td className={tdCls}><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
