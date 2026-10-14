import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db/client";
import { getBookingDetail, listStaff } from "@/server/admin-queries";
import { fetchTimeSlots } from "@/server/catalog-db";
import { paymentSummary } from "@/server/payments";
import { ActionForm, inputCls, labelCls } from "@/components/admin/action-form";
import { Card, PageTitle, StatusBadge, tableCls, tdCls, thCls } from "@/components/admin/ui";
import { can } from "@/lib/permissions";
import { formatNaira } from "@/lib/money";
import { nextStatuses } from "@/lib/booking-status";
import { and, eq } from "drizzle-orm";
import { bookingAssignments, staffProfiles } from "@/server/db/schema";
import { addNote, assign, changeStatus, manualPayment, quote, refund, reschedule, unassign } from "./actions";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

const fmt = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default async function BookingDetail({ params }: PageProps<"/admin/bookings/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const full = can(user.role, "bookings.read");
  if (!full) {
    // Cleaners may open only jobs actively assigned to them.
    if (!can(user.role, "bookings.read_assigned")) redirect("/admin/forbidden");
    const [mine] = await db.select({ x: bookingAssignments.id }).from(bookingAssignments)
      .innerJoin(staffProfiles, eq(staffProfiles.id, bookingAssignments.staffId))
      .where(and(eq(bookingAssignments.bookingId, id), eq(bookingAssignments.status, "active"), eq(staffProfiles.userId, user.id))).limit(1);
    if (!mine) notFound();
  }

  const d = await getBookingDetail(db, id);
  if (!d) notFound();
  const b = d.b;
  const [summary, staff, slots] = await Promise.all([paymentSummary(db, id), full ? listStaff(db) : Promise.resolve([]), fetchTimeSlots(db)]);
  const next = nextStatuses(b.status);
  const manage = can(user.role, "bookings.manage");
  const live = d.quotes.find((q) => q.status === "sent" || q.status === "accepted");
  const activeAssigned = d.assigned.filter((a) => a.a.status === "active");

  return (
    <>
      <PageTitle
        title={b.reference}
        sub={`${d.service} · created ${fmt(b.createdAt)}`}
        actions={<div className="flex items-center gap-3"><StatusBadge status={b.status} /><Link href={full ? "/admin/bookings" : "/admin/jobs"} className="text-sm font-semibold underline">← Back</Link></div>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Customer and location">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-mute">Customer</dt><dd className="font-semibold">{d.customer.fullName}</dd></div>
              <div><dt className="text-ink-mute">Phone</dt><dd><a className="font-semibold underline" href={`tel:${d.customer.phone}`}>{d.customer.phone}</a>{" · "}<a className="underline" href={`https://wa.me/${d.customer.phone.replace("+", "")}`} rel="noopener">WhatsApp</a></dd></div>
              {full ? <div><dt className="text-ink-mute">Email</dt><dd>{d.customer.email ?? "—"}</dd></div> : null}
              <div><dt className="text-ink-mute">Address</dt><dd>{b.address}, {b.neighbourhood ? `${b.neighbourhood}, ` : ""}{b.city}, {b.state}</dd></div>
              <div className="sm:col-span-2"><dt className="text-ink-mute">Access instructions</dt><dd>{b.accessInstructions ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-ink-mute">Customer notes</dt><dd>{b.instructions ?? "—"}</dd></div>
            </dl>
          </Card>
          <Card title="Schedule and scope">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-mute">Date</dt><dd className="font-semibold">{b.scheduledDate} · {d.slot}</dd></div>
              <div><dt className="text-ink-mute">Frequency</dt><dd className="capitalize">{b.frequency.replace("_", " ")}</dd></div>
              <div><dt className="text-ink-mute">Property</dt><dd><span className="capitalize">{b.propertyType}</span>{b.bedrooms != null ? `, ${b.bedrooms} bed / ${b.bathrooms} bath` : ""}{b.sizeSqm ? `, ~${b.sizeSqm} m²` : ""}</dd></div>
              <div><dt className="text-ink-mute">Materials</dt><dd>{b.materials?.replace("_", " ") ?? "—"}</dd></div>
            </dl>
            <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-forest-800">Agreed scope snapshot</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-sand p-3 text-xs">{JSON.stringify(b.scopeSnapshot, null, 2)}</pre></details>
          </Card>

          {full ? (
            <Card title="Notes (internal)">
              {can(user.role, "notes.write") ? (
                <ActionForm action={addNote.bind(null, id)} submitLabel="Add note"><label className={labelCls} htmlFor="body">Note</label><textarea id="body" name="body" required maxLength={2000} className={`${inputCls} h-20 py-2`} /></ActionForm>
              ) : null}
              <ul className="mt-4 space-y-3 text-sm">{d.notes.map((n) => <li key={n.n.id} className="rounded bg-sand p-3"><p>{n.n.body}</p><p className="mt-1 text-xs text-ink-mute">{n.author} · {fmt(n.n.createdAt)}</p></li>)}{d.notes.length === 0 ? <li className="text-ink-soft">No notes yet.</li> : null}</ul>
            </Card>
          ) : null}

          <Card title="History">
            <ol className="space-y-2 text-sm">{d.history.map((h) => <li key={h.h.id}><span className="font-semibold capitalize">{h.h.toStatus.replace("_", " ")}</span> <span className="text-ink-mute">· {fmt(h.h.createdAt)} · {h.actor ?? "Customer / system"}{h.h.note ? ` · ${h.h.note}` : ""}</span></li>)}</ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Actions">
            <div className="space-y-5">
              {(b.status === "requested" || b.status === "quoted") && manage ? (
                <ActionForm action={changeStatus.bind(null, id, "confirmed")} submitLabel="Approve and confirm" confirm="Confirm this booking?">
                  <p className="text-xs text-ink-soft">{b.requiresQuotation ? "Requires an accepted quotation first." : "Locks the estimate as the agreed price."}</p>
                </ActionForm>
              ) : null}
              {b.status === "scheduled" && can(user.role, "bookings.update_progress") ? <ActionForm action={changeStatus.bind(null, id, "in_progress")} submitLabel="Start job" /> : null}
              {b.status === "in_progress" && can(user.role, "bookings.update_progress") ? <ActionForm action={changeStatus.bind(null, id, "completed")} submitLabel="Mark completed" confirm="Mark this job as completed?" /> : null}
              {(b.status === "requested" || b.status === "quoted") && manage ? (
                <ActionForm action={changeStatus.bind(null, id, "rejected")} submitLabel="Reject request" variant="outline" confirm="Reject this request?">
                  <label className={labelCls} htmlFor="rej">Reason (sent to customer)</label><input id="rej" name="reason" required className={inputCls} />
                </ActionForm>
              ) : null}
              {next.includes("cancelled") && manage ? (
                <ActionForm action={changeStatus.bind(null, id, "cancelled")} submitLabel="Cancel booking" variant="danger" confirm="Cancel this booking? This cannot be undone.">
                  <label className={labelCls} htmlFor="can">Reason</label><input id="can" name="reason" required className={inputCls} />
                </ActionForm>
              ) : null}
              {next.length === 0 ? <p className="text-sm text-ink-soft">This booking is closed. No further actions.</p> : null}
            </div>
          </Card>

          {can(user.role, "quotations.manage") && (b.status === "requested" || b.status === "quoted") ? (
            <Card title={live ? "Revise quotation" : "Send quotation"}>
              <ActionForm action={quote.bind(null, id)} submitLabel="Send quotation">
                <div><label className={labelCls} htmlFor="amount">Amount (₦)</label><input id="amount" name="amount" inputMode="decimal" required className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="validUntil">Valid until</label><input id="validUntil" type="date" name="validUntil" className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="qn">Notes to customer</label><textarea id="qn" name="notes" maxLength={1000} className={`${inputCls} h-16 py-2`} /></div>
              </ActionForm>
            </Card>
          ) : null}

          <Card title="Quotations">
            {d.quotes.length === 0 ? <p className="text-sm text-ink-soft">None.</p> : (
              <ul className="space-y-2 text-sm">{d.quotes.map((q) => <li key={q.id} className="flex justify-between"><span>v{q.version} · {formatNaira(q.amountKobo)}</span><span className="capitalize text-ink-mute">{q.status}</span></li>)}</ul>
            )}
          </Card>

          {manage && ["confirmed", "scheduled"].includes(b.status) ? (
            <Card title="Cleaners">
              <ul className="mb-3 space-y-2 text-sm">{activeAssigned.map((a) => (
                <li key={a.a.id} className="flex items-center justify-between gap-2"><span>{a.name}</span>
                  <ActionForm action={unassign.bind(null, id, a.a.staffId)} submitLabel="Remove" variant="ghost" className="space-y-0" /></li>))}
                {activeAssigned.length === 0 ? <li className="text-ink-soft">No cleaner assigned.</li> : null}</ul>
              <ActionForm action={assign.bind(null, id)} submitLabel="Assign">
                <label className={labelCls} htmlFor="staffId">Cleaner</label>
                <select id="staffId" name="staffId" required className={inputCls}><option value="">Select…</option>{staff.filter((s) => s.active).map((s) => <option key={s.staffId} value={s.staffId}>{s.name}</option>)}</select>
              </ActionForm>
            </Card>
          ) : null}

          {manage && ["requested", "quoted", "confirmed", "scheduled"].includes(b.status) ? (
            <Card title="Reschedule">
              <ActionForm action={reschedule.bind(null, id)} submitLabel="Reschedule">
                <div><label className={labelCls} htmlFor="date">New date</label><input id="date" type="date" name="date" required defaultValue={b.scheduledDate} className={inputCls} /></div>
                <div><label className={labelCls} htmlFor="slot">Time slot</label><select id="slot" name="slot" defaultValue={b.timeSlotId} className={inputCls}>{slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
              </ActionForm>
            </Card>
          ) : null}

          {can(user.role, "payments.read") ? (
            <Card title="Payment">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Agreed price</dt><dd>{summary.finalKobo !== null ? formatNaira(summary.finalKobo) : b.estimateKobo !== null ? `Est. ${formatNaira(b.estimateKobo)}` : "To be quoted"}</dd></div>
                <div className="flex justify-between"><dt>Paid (net)</dt><dd>{formatNaira(summary.netPaidKobo)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Outstanding</dt><dd>{summary.outstandingKobo === null ? "—" : formatNaira(summary.outstandingKobo)}</dd></div>
              </dl>
              <ul className="mt-3 space-y-3 text-sm">{d.payments.map((p) => (
                <li key={p.id} className="rounded bg-sand p-3">
                  <p className="flex justify-between"><span>{formatNaira(p.amountKobo)} · {p.provider}</span><span className="capitalize">{p.status.replace("_", " ")}</span></p>
                  <p className="text-xs text-ink-mute">{p.reference}{p.verifiedAt ? " · verified" : " · unverified"}</p>
                  {can(user.role, "payments.refund") && ["success", "partially_refunded"].includes(p.status) ? (
                    <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-danger">Record refund</summary>
                      <ActionForm action={refund.bind(null, id, p.id)} submitLabel="Record refund" variant="danger" confirm="Record this refund?" className="mt-2">
                        <input name="amount" placeholder="Amount (₦)" required className={inputCls} aria-label="Refund amount in naira" /><input name="reason" placeholder="Reason" required className={inputCls} aria-label="Refund reason" />
                      </ActionForm></details>) : null}
                </li>))}</ul>
              {can(user.role, "payments.record") && summary.finalKobo !== null && (summary.outstandingKobo ?? 0) > 0 ? (
                <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-forest-800">Record cash / transfer payment</summary>
                  <ActionForm action={manualPayment.bind(null, id)} submitLabel="Record payment" className="mt-2">
                    <input name="amount" placeholder="Amount (₦)" required className={inputCls} aria-label="Amount in naira" /><input name="note" placeholder="Note (e.g. bank transfer ref)" className={inputCls} aria-label="Payment note" />
                  </ActionForm></details>) : null}
            </Card>
          ) : null}

          <Card title="Pricing lines">
            {d.items.length === 0 ? <p className="text-sm text-ink-soft">No estimate (quotation required).</p> : (
              <table className={tableCls}><tbody>{d.items.map((i) => <tr key={i.id}><td className={tdCls}>{i.name}</td><td className={`${tdCls} text-right`}>{formatNaira(i.priceKobo)}</td></tr>)}</tbody>
                <thead className="sr-only"><tr><th className={thCls}>Item</th><th className={thCls}>Price</th></tr></thead></table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
