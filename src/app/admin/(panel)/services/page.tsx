import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { fetchCategories, fetchServices } from "@/server/catalog-db";
import { ActionForm, inputCls, labelCls } from "@/components/admin/action-form";
import { Card, PageTitle, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { createServiceAction } from "./actions";

export const metadata: Metadata = { title: "Services", robots: { index: false } };

export default async function ServicesAdmin() {
  const user = await requirePagePermission("services.read");
  const [services, cats] = await Promise.all([fetchServices(db, { includeDisabled: true }), fetchCategories(db)]);
  const write = can(user.role, "services.write");
  return (
    <>
      <PageTitle title="Services" sub="Services are hidden from customers until enabled." />
      <Card>
        <table className={tableCls}>
          <thead><tr>{["Service", "Category", "Pricing", "Status"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {services.map((s) => (
              <tr key={s.slug}>
                <td className={tdCls}>{write ? <Link className="font-semibold text-forest-800 underline" href={`/admin/services/${s.slug}`}>{s.name}</Link> : s.name}</td>
                <td className={tdCls}>{s.categorySlug}</td><td className={tdCls}>{s.pricing.model.replace(/_/g, " ")}</td>
                <td className={tdCls}>{s.enabled ? <span className="font-semibold text-forest-700">Enabled</span> : <span className="text-ink-mute">Disabled</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {write ? (
        <Card title="Add a service" className="mt-6 max-w-xl">
          <ActionForm action={createServiceAction} submitLabel="Create (disabled)">
            <div><label className={labelCls} htmlFor="name">Name</label><input id="name" name="name" required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="slug">URL slug</label><input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="window-cleaning" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="category">Category</label><select id="category" name="category" className={inputCls}>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
          </ActionForm>
        </Card>
      ) : null}
    </>
  );
}
