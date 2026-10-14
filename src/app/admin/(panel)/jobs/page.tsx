import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listBookings } from "@/server/admin-queries";
import { Card, PageTitle, StatusBadge, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const metadata: Metadata = { title: "My jobs", robots: { index: false } };

export default async function JobsPage() {
  const user = await requirePagePermission("bookings.read_assigned");
  const { rows } = await listBookings(db, {}, { staffUserId: user.id });
  const active = rows.filter((r) => ["scheduled", "in_progress"].includes(r.status));
  return (
    <>
      <PageTitle title="My jobs" sub="Jobs assigned to you." />
      <Card>
        {active.length === 0 ? <p className="text-sm text-ink-soft">No upcoming jobs assigned to you.</p> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr>{["Date", "Time", "Service", "Address", "Status"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {active.map((r) => (
                  <tr key={r.id}>
                    <td className={tdCls}><Link className="font-semibold text-forest-800 underline" href={`/admin/bookings/${r.id}`}>{r.scheduledDate}</Link></td>
                    <td className={tdCls}>{r.slot}</td><td className={tdCls}>{r.service}</td><td className={tdCls}>{r.address}, {r.city}</td>
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
