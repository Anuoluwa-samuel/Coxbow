import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { getCustomer } from "@/server/admin-queries";
import { Card, PageTitle, StatusBadge, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { formatNaira } from "@/lib/money";

export const metadata: Metadata = { title: "Customer", robots: { index: false } };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  await requirePagePermission("customers.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getCustomer(db, id);
  if (!d) notFound();
  return (
    <>
      <PageTitle title={d.customer.fullName} sub={`${d.customer.phone}${d.customer.email ? ` · ${d.customer.email}` : ""}`} actions={<Link href="/admin/customers" className="text-sm font-semibold underline">← Customers</Link>} />
      <Card title="Booking history">
        <table className={tableCls}><thead><tr>{["Reference", "Service", "Date", "Price", "Status"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{d.history.map((b) => (
            <tr key={b.id}><td className={tdCls}><Link className="font-semibold text-forest-800 underline" href={`/admin/bookings/${b.id}`}>{b.reference}</Link></td><td className={tdCls}>{b.service}</td><td className={tdCls}>{b.date}</td>
              <td className={tdCls}>{b.finalKobo !== null ? formatNaira(b.finalKobo) : b.estimateKobo !== null ? `~${formatNaira(b.estimateKobo)}` : "Quote"}</td><td className={tdCls}><StatusBadge status={b.status} /></td></tr>))}</tbody></table>
      </Card>
    </>
  );
}
