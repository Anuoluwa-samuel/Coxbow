import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { fetchCategories, fetchServices } from "@/server/catalog-db";
import { ActionForm, inputCls, labelCls } from "@/components/admin/action-form";
import { Card, PageTitle, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { createServiceAction, deleteCategoryAction, saveCategoryAction } from "./actions";

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
        <Card title="Categories" className="mt-6 max-w-3xl">
          <ul className="mb-4 divide-y divide-line text-sm">
            {cats.map((c) => {
              const count = services.filter((s) => s.categorySlug === c.slug).length;
              return (
                <li key={c.slug} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><span className="font-semibold">{c.name}</span> <span className="text-ink-mute">· {c.audience} · {count} service{count === 1 ? "" : "s"}</span></span>
                  {count === 0 ? <ActionForm action={deleteCategoryAction.bind(null, c.slug)} submitLabel="Delete" variant="ghost" confirm={`Delete the "${c.name}" category?`} className="space-y-0" /> : null}
                </li>
              );
            })}
          </ul>
          <ActionForm action={saveCategoryAction} submitLabel="Save category">
            <p className="text-xs text-ink-soft">Using an existing slug updates that category; a new slug adds one.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" placeholder="Name, e.g. Outdoor" required className={inputCls} aria-label="Category name" />
              <input name="slug" placeholder="slug, e.g. outdoor" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} aria-label="Category slug" />
              <select name="audience" className={inputCls} aria-label="Audience" defaultValue="both"><option value="both">Homes and businesses</option><option value="residential">Residential</option><option value="commercial">Commercial</option></select>
              <input name="sortOrder" type="number" min={0} defaultValue={cats.length} className={inputCls} aria-label="Sort order" />
            </div>
            <input name="description" placeholder="Short description" className={inputCls} aria-label="Category description" />
          </ActionForm>
        </Card>
      ) : null}
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
