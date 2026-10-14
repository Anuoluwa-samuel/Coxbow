import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { fetchBookingSettings, fetchServiceAreas, fetchTimeSlots } from "@/server/catalog-db";
import { ActionForm, inputCls, labelCls } from "@/components/admin/action-form";
import { Card, PageTitle } from "@/components/admin/ui";
import { saveArea, saveSettings, saveSlot } from "./actions";

export const metadata: Metadata = { title: "Areas and hours", robots: { index: false } };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function AreasAdmin() {
  await requirePagePermission("areas.write");
  const [areas, slots, settings] = await Promise.all([fetchServiceAreas(db, { includeDisabled: true }), fetchTimeSlots(db), fetchBookingSettings(db)]);
  return (
    <>
      <PageTitle title="Areas and operating hours" sub="Customers can only book where an enabled area covers their address." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Service areas">
          <ul className="mb-4 space-y-2 text-sm">{areas.map((a) => <li key={`${a.state}-${a.city}`}><span className="font-semibold">{a.city}, {a.state}</span> {a.enabled ? "" : <em className="text-ink-mute">(off)</em>}<br /><span className="text-xs text-ink-mute">{a.neighbourhoods.length ? a.neighbourhoods.join(", ") : "Whole city"}</span></li>)}</ul>
          <ActionForm action={saveArea} submitLabel="Save area">
            <p className="text-xs text-ink-soft">Existing state + city is updated; otherwise a new area is added.</p>
            <div className="grid gap-3 sm:grid-cols-2"><input name="state" placeholder="State" required className={inputCls} aria-label="State" /><input name="city" placeholder="City / area" required className={inputCls} aria-label="City" /></div>
            <input name="neighbourhoods" placeholder="Neighbourhoods, comma separated (blank = whole city)" className={inputCls} aria-label="Neighbourhoods" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked className="size-4 accent-forest-800" /> Enabled</label>
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card title="Booking rules">
            <ActionForm action={saveSettings} submitLabel="Save rules">
              <fieldset><legend className={labelCls}>Operating days</legend><div className="flex flex-wrap gap-3">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="day" value={i} defaultChecked={settings.operatingDays.includes(i)} className="size-4 accent-forest-800" />{d.slice(0, 3)}</label>)}</div></fieldset>
              <div><label className={labelCls} htmlFor="maxAdvanceDays">How far ahead customers can book (days)</label><input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={settings.maxAdvanceDays} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="customerChangeNoticeHours">Customers can cancel or reschedule themselves up to this many hours before the start</label><input id="customerChangeNoticeHours" name="customerChangeNoticeHours" type="number" min={0} max={720} defaultValue={settings.customerChangeNoticeHours} className={inputCls} /><p className="mt-1 text-xs text-ink-mute">Inside this window customers are asked to contact you. Match your published cancellation policy.</p></div>
            </ActionForm>
          </Card>
          <Card title="Time slots and capacity">
            <div className="space-y-4">{slots.map((s) => (
              <ActionForm key={s.id} action={saveSlot.bind(null, s.id)} submitLabel="Save">
                <p className="text-sm font-semibold">{s.label}</p>
                <div className="flex items-center gap-3"><label className={`${labelCls} mb-0`} htmlFor={`cap-${s.id}`}>Jobs at once</label><input id={`cap-${s.id}`} name="capacity" type="number" min={1} defaultValue={s.capacity} className={`${inputCls} w-24`} />
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-4 accent-forest-800" />On</label></div>
              </ActionForm>))}</div>
          </Card>
        </div>
      </div>
    </>
  );
}
