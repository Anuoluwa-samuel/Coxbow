import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listPayments } from "@/server/admin-queries";
import { ActionForm } from "@/components/admin/action-form";
import { Card, PageTitle, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { formatNaira } from "@/lib/money";
import { reconcile } from "./actions";

export const metadata: Metadata = { title: "Payments", robots: { index: false } };

export default async function PaymentsPage() {
  const user = await requirePagePermission("payments.read");
  const rows = await listPayments(db);
  const canRec = can(user.role, "payments.record");
  return (
    <>
      <PageTitle title="Payments" sub="Only provider-verified or staff-recorded payments count as paid." />
      <Card>
        {rows.length === 0 ? <p className="text-sm text-ink-soft">No payments yet.</p> : (
          <div className="overflow-x-auto"><table className={tableCls}>
            <thead><tr>{["Date", "Booking", "Customer", "Amount", "Method", "Status", "Reconciled"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map(({ p, reference, customer }) => (
              <tr key={p.id}>
                <td className={tdCls}>{p.createdAt.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</td>
                <td className={tdCls}><Link className="font-semibold text-forest-800 underline" href={`/admin/bookings/${p.bookingId}`}>{reference}</Link></td>
                <td className={tdCls}>{customer}</td><td className={tdCls}>{formatNaira(p.amountKobo)}</td><td className={`${tdCls} capitalize`}>{p.provider}</td>
                <td className={`${tdCls} capitalize`}>{p.status.replace("_", " ")}{p.verifiedAt ? "" : " (unverified)"}</td>
                <td className={tdCls}>{p.verifiedAt && canRec ? <ActionForm action={reconcile.bind(null, p.id, !p.reconciled)} submitLabel={p.reconciled ? "Yes · undo" : "Mark"} variant="ghost" className="space-y-0" /> : p.reconciled ? "Yes" : "—"}</td>
              </tr>))}</tbody></table></div>)}
      </Card>
    </>
  );
}
