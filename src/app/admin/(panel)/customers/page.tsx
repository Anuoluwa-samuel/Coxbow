import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listCustomers } from "@/server/admin-queries";
import { Card, PageTitle, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { inputCls } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requirePagePermission("customers.read");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80);
  const rows = await listCustomers(db, q);
  return (
    <>
      <PageTitle title="Customers" />
      <Card className="mb-6"><form role="search" className="flex gap-2"><label htmlFor="q" className="sr-only">Search customers</label><input id="q" name="q" defaultValue={q} placeholder="Name, phone or email" className={inputCls} /><Button size="sm" type="submit">Search</Button></form></Card>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-ink-soft">No customers found.</p> : (
          <div className="overflow-x-auto"><table className={tableCls}>
            <thead><tr>{["Name", "Phone", "Email", "Bookings", "Since"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map((c) => (
              <tr key={c.id}><td className={tdCls}><Link className="font-semibold text-forest-800 underline" href={`/admin/customers/${c.id}`}>{c.name}</Link></td><td className={tdCls}>{c.phone}</td><td className={tdCls}>{c.email ?? "—"}</td><td className={tdCls}>{c.bookings}</td><td className={tdCls}>{c.createdAt.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</td></tr>))}</tbody>
          </table></div>)}
      </Card>
    </>
  );
}
