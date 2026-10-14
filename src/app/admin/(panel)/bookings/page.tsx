import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listBookings } from "@/server/admin-queries";
import { fetchServices, fetchServiceAreas } from "@/server/catalog-db";
import { Card, PageTitle, StatusBadge, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { inputCls, labelCls } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { BOOKING_STATUSES } from "@/lib/booking-status";
import { formatNaira } from "@/lib/money";

export const metadata: Metadata = { title: "Bookings", robots: { index: false } };

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requirePagePermission("bookings.read");
  const sp = await searchParams;
  const g = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v) || undefined; };
  const f = { q: g("q"), status: g("status"), service: g("service"), city: g("city"), from: g("from"), to: g("to"), page: Number(g("page") ?? 1) || 1 };
  const [{ rows, total, page, pages }, services, areas] = await Promise.all([listBookings(db, f), fetchServices(db, { includeDisabled: true }), fetchServiceAreas(db, { includeDisabled: true })]);
  const cities = [...new Set(areas.map((a) => a.city))];
  const qs = (p: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== "page") as [string, string][]), page: String(p) }).toString();

  return (
    <>
      <PageTitle title="Bookings" sub={`${total} matching`} />
      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
          <div className="lg:col-span-2"><label className={labelCls} htmlFor="q">Search</label><input id="q" name="q" defaultValue={f.q} placeholder="Reference, name, phone, address" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="status">Status</label><select id="status" name="status" defaultValue={f.status ?? ""} className={inputCls}><option value="">All</option>{BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="service">Service</label><select id="service" name="service" defaultValue={f.service ?? ""} className={inputCls}><option value="">All</option>{services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="city">City</label><select id="city" name="city" defaultValue={f.city ?? ""} className={inputCls}><option value="">All</option>{cities.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2"><div><label className={labelCls} htmlFor="from">From</label><input id="from" type="date" name="from" defaultValue={f.from} className={inputCls} /></div><div><label className={labelCls} htmlFor="to">To</label><input id="to" type="date" name="to" defaultValue={f.to} className={inputCls} /></div></div>
          <div className="flex items-end gap-2 lg:col-span-6"><Button type="submit" size="sm">Apply filters</Button><Link href="/admin/bookings" className="px-2 text-sm font-semibold text-forest-800 underline">Reset</Link></div>
        </form>
      </Card>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-ink-soft">No bookings match these filters.</p> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr>{["Reference", "Customer", "Service", "Scheduled", "Location", "Price", "Status"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={tdCls}><Link className="font-semibold text-forest-800 underline" href={`/admin/bookings/${r.id}`}>{r.reference}</Link></td>
                    <td className={tdCls}>{r.customer}<br /><span className="text-xs text-ink-mute">{r.phone}</span></td>
                    <td className={tdCls}>{r.service}</td>
                    <td className={tdCls}>{r.scheduledDate}<br /><span className="text-xs text-ink-mute">{r.slot}</span></td>
                    <td className={tdCls}>{r.city}</td>
                    <td className={tdCls}>{r.finalKobo !== null ? formatNaira(r.finalKobo) : r.estimateKobo !== null ? `~${formatNaira(r.estimateKobo)}` : "Quote"}</td>
                    <td className={tdCls}><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link className="font-semibold underline" href={`/admin/bookings?${qs(page - 1)}`}>← Previous</Link> : <span />}
            <span className="text-ink-mute">Page {page} of {pages}</span>
            {page < pages ? <Link className="font-semibold underline" href={`/admin/bookings?${qs(page + 1)}`}>Next →</Link> : <span />}
          </nav>
        ) : null}
      </Card>
    </>
  );
}
