import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { fetchCategories, fetchService } from "@/server/catalog-db";
import { PhotoUpload } from "./photo-upload";
import { ActionForm, inputCls, labelCls } from "@/components/admin/action-form";
import { Card, PageTitle } from "@/components/admin/ui";
import { removeImageAction, upsertAddonAction, updateServiceAction } from "../actions";

export const metadata: Metadata = { title: "Edit service", robots: { index: false } };

export default async function EditService({ params }: PageProps<"/admin/services/[slug]">) {
  await requirePagePermission("services.write");
  const { slug } = await params;
  const [s, cats] = await Promise.all([fetchService(db, slug, { includeDisabled: true }), fetchCategories(db)]);
  if (!s) notFound();
  const p = s.pricing;
  const area = (id: string, label: string, v: string[], rows = 4) => (
    <div><label className={labelCls} htmlFor={id}>{label} (one per line)</label><textarea id={id} name={id} defaultValue={v.join("\n")} rows={rows} className={`${inputCls} h-auto py-2`} /></div>
  );
  return (
    <>
      <PageTitle title={s.name} sub={`/services/${s.slug}`} actions={<Link href="/admin/services" className="text-sm font-semibold underline">← All services</Link>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Details and pricing" className="xl:col-span-2">
          <ActionForm action={updateServiceAction.bind(null, slug)} submitLabel="Save service">
            <div><label className={labelCls} htmlFor="name">Name</label><input id="name" name="name" defaultValue={s.name} required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="categorySlug">Category</label><select id="categorySlug" name="categorySlug" defaultValue={s.categorySlug} className={inputCls}>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            <div><label className={labelCls} htmlFor="summary">Summary</label><input id="summary" name="summary" defaultValue={s.summary} required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={s.description} rows={4} required className={`${inputCls} h-auto py-2`} /></div>
            {area("idealFor", "Ideal for", s.idealFor, 3)}{area("includes", "Included", s.includes)}{area("excludes", "Not included", s.excludes)}{area("extraCharges", "Extra charges", s.extraCharges, 3)}
            <fieldset className="rounded border border-line p-3"><legend className="px-1 text-xs font-semibold text-ink-soft">Pricing</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={labelCls} htmlFor="pricingModel">Model</label>
                  <select id="pricingModel" name="pricingModel" defaultValue={p.model} className={inputCls}>
                    <option value="fixed">Fixed price</option><option value="by_size">By property size</option><option value="base_plus_addons">Base + add-ons</option>
                    <option value="inspection">Inspection-based quotation</option><option value="corporate_quote">Corporate quotation</option></select></div>
                <div><label className={labelCls} htmlFor="baseNaira">Base price (₦) — fixed / base + add-ons</label><input id="baseNaira" name="baseNaira" defaultValue={p.baseKobo ? String(p.baseKobo / 100) : ""} className={inputCls} /></div>
              </div>
              <div className="mt-3"><label className={labelCls} htmlFor="tiers">Size tiers — &quot;max m²: price in ₦&quot;, one per line</label>
                <textarea id="tiers" name="tiers" rows={3} defaultValue={(p.sizeTiers ?? []).map((t) => `${t.maxSqm}: ${t.priceKobo / 100}`).join("\n")} className={`${inputCls} h-auto py-2 font-mono`} /></div>
              <div className="mt-3"><label className={labelCls} htmlFor="pricingNote">Pricing note shown to customers</label><input id="pricingNote" name="pricingNote" defaultValue={s.pricingNote} className={inputCls} /></div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={labelCls} htmlFor="minNoticeHours">Minimum notice (hours)</label><input id="minNoticeHours" name="minNoticeHours" type="number" min={0} defaultValue={s.minNoticeHours} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="durationMinutes">Typical duration (minutes)</label><input id="durationMinutes" name="durationMinutes" type="number" min={15} defaultValue={s.durationMinutes} className={inputCls} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-4 accent-forest-800" /> Enabled (visible and bookable)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="popular" defaultChecked={s.popular} className="size-4 accent-forest-800" /> Show on homepage as popular</label>
          </ActionForm>
        </Card>
        <Card title="Photo" className="xl:col-start-3">
          {s.imageId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/media/${s.imageId}`} alt={s.imageAlt ?? s.name} className="mb-3 aspect-[16/10] w-full rounded-[var(--radius-control)] object-cover" />
          ) : <p className="mb-3 text-sm text-ink-soft">No photo yet. A placeholder is shown on the public site.</p>}
          <PhotoUpload slug={slug} hasImage={Boolean(s.imageId)} defaultAlt={s.imageAlt ?? ""} />
          {s.imageId ? <ActionForm action={removeImageAction.bind(null, slug)} submitLabel="Remove photo" variant="outline" confirm="Remove this photo?" className="mt-3" /> : null}
          <p className="mt-3 text-xs text-ink-mute">JPEG, PNG or WebP, up to 1.5 MB. About 1600 px wide is plenty. Use real photos of your own work.</p>
        </Card>
        <Card title="Add-ons">
          <ul className="mb-4 space-y-2 text-sm">{s.addons.map((a) => <li key={a.slug} className="flex justify-between"><span>{a.name}{a.enabled ? "" : " (off)"}</span><span>₦{(a.priceKobo / 100).toLocaleString()}</span></li>)}{s.addons.length === 0 ? <li className="text-ink-soft">None.</li> : null}</ul>
          <ActionForm action={upsertAddonAction.bind(null, slug)} submitLabel="Save add-on">
            <p className="text-xs text-ink-soft">Use an existing slug to edit it.</p>
            <input name="addonSlug" placeholder="slug, e.g. inside-oven" required className={inputCls} aria-label="Add-on slug" />
            <input name="name" placeholder="Name" required className={inputCls} aria-label="Add-on name" />
            <input name="price" placeholder="Price (₦)" required className={inputCls} aria-label="Add-on price in naira" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked className="size-4 accent-forest-800" /> Enabled</label>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
