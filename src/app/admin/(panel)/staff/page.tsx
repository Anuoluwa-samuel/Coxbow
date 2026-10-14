import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listStaff, upcomingAssignments } from "@/server/admin-queries";
import { staffAvailability } from "@/server/db/schema";
import { ActionForm, inputCls, labelCls } from "@/components/admin/action-form";
import { Card, PageTitle, StatusBadge } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { addSlot, createStaff, removeSlot, toggleActive } from "./actions";

export const metadata: Metadata = { title: "Staff", robots: { index: false } };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function StaffAdmin() {
  const user = await requirePagePermission("staff.manage");
  const staff = await listStaff(db);
  const details = await Promise.all(staff.map(async (s) => ({
    s, avail: await db.select().from(staffAvailability).where(eq(staffAvailability.staffId, s.staffId)).orderBy(staffAvailability.dayOfWeek, staffAvailability.startTime),
    jobs: await upcomingAssignments(db, s.staffId),
  })));
  const fmt = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
  return (
    <>
      <PageTitle title="Staff" sub="Cleaner accounts, availability and upcoming assignments." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {details.length === 0 ? <Card><p className="text-sm text-ink-soft">No cleaners yet. Add one.</p></Card> : null}
          {details.map(({ s, avail, jobs }) => (
            <Card key={s.staffId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-lg font-semibold">{s.name} {s.active ? null : <span className="text-sm text-danger">(inactive)</span>}</p><p className="text-sm text-ink-soft">{s.email}{s.phone ? ` · ${s.phone}` : ""}</p></div>
                <ActionForm action={toggleActive.bind(null, s.userId, !s.active)} submitLabel={s.active ? "Deactivate" : "Reactivate"} variant="outline" confirm={s.active ? "Deactivate this account and sign them out?" : undefined} className="space-y-0" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><h3 className="mb-2 font-sans text-sm font-semibold">Weekly availability</h3>
                  <ul className="space-y-1 text-sm">{avail.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span>{DAYS[a.dayOfWeek]} {a.startTime.slice(0, 5)}–{a.endTime.slice(0, 5)}</span><ActionForm action={removeSlot.bind(null, s.staffId, a.id)} submitLabel="×" variant="ghost" className="space-y-0" /></li>)}{avail.length === 0 ? <li className="text-ink-soft">Not set.</li> : null}</ul>
                  <ActionForm action={addSlot.bind(null, s.staffId)} submitLabel="Add" className="mt-3">
                    <div className="flex gap-2"><select name="day" aria-label="Day" className={inputCls}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select><input type="time" name="start" defaultValue="08:00" aria-label="Start" className={inputCls} /><input type="time" name="end" defaultValue="17:00" aria-label="End" className={inputCls} /></div>
                  </ActionForm></div>
                <div><h3 className="mb-2 font-sans text-sm font-semibold">Upcoming assignments</h3>
                  <ul className="space-y-2 text-sm">{jobs.map((j) => <li key={j.id}><Link href={`/admin/bookings/${j.id}`} className="font-semibold underline">{j.reference}</Link> <StatusBadge status={j.status} /><br /><span className="text-xs text-ink-mute">{fmt(j.startsAt)} · {j.service} · {j.city}</span></li>)}{jobs.length === 0 ? <li className="text-ink-soft">None.</li> : null}</ul></div>
              </div>
            </Card>
          ))}
        </div>
        <Card title="Add staff member">
          <ActionForm action={createStaff} submitLabel="Create account">
            <div><label className={labelCls} htmlFor="fullName">Full name</label><input id="fullName" name="fullName" required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="email">Email (sign-in)</label><input id="email" type="email" name="email" required autoComplete="off" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="phone">Phone</label><input id="phone" name="phone" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="role">Role</label><select id="role" name="role" className={inputCls}><option value="cleaner">Cleaner</option>{can(user.role, "users.manage") ? <><option value="manager">Manager</option><option value="admin">Administrator</option></> : null}</select></div>
            <div><label className={labelCls} htmlFor="password">Temporary password (12+ characters)</label><input id="password" type="password" name="password" minLength={12} required autoComplete="new-password" className={inputCls} /></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
