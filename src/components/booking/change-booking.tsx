"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlotInfo } from "./types";

interface Props {
  reference: string;
  token: string;
  serviceSlug: string;
  minDate: string;
  canReschedule: boolean;
  canCancel: boolean;
  rescheduleBlockedReason: string | null;
  cancelBlockedReason: string | null;
  noticeHours: number;
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function ChangeBooking(p: Props) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [slotError, setSlotError] = useState(false);
  const [slotId, setSlotId] = useState("");
  const [busy, setBusy] = useState<"reschedule" | "cancel" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!date) return;
    const ctrl = new AbortController();
    fetch(`/api/availability?service=${encodeURIComponent(p.serviceSlug)}&date=${date}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d: { slots: SlotInfo[] }) => { setSlots(d.slots); setSlotError(false); })
      .catch((e) => { if (e?.name !== "AbortError") { setSlots(null); setSlotError(true); } });
    return () => ctrl.abort();
  }, [date, p.serviceSlug]);

  async function reschedule() {
    setBusy("reschedule"); setMsg(null);
    try {
      const { ok, data } = await post(`/api/bookings/${encodeURIComponent(p.reference)}/reschedule`, { token: p.token, date, slotId });
      if (ok) { setMsg({ ok: true, text: "Your booking has been rescheduled." }); setDate(""); setSlotId(""); setSlots(null); router.refresh(); }
      else setMsg({ ok: false, text: data.message ?? "We could not reschedule. Nothing was changed." });
    } catch { setMsg({ ok: false, text: "Network problem. Nothing was changed." }); }
    setBusy(null);
  }

  async function cancel() {
    setBusy("cancel"); setMsg(null);
    try {
      const { ok, data } = await post(`/api/bookings/${encodeURIComponent(p.reference)}/cancel`, { token: p.token, reason });
      if (ok) { setMsg({ ok: true, text: "Your booking has been cancelled." }); setConfirmingCancel(false); router.refresh(); }
      else setMsg({ ok: false, text: data.message ?? "We could not cancel. Nothing was changed." });
    } catch { setMsg({ ok: false, text: "Network problem. Nothing was changed." }); }
    setBusy(null);
  }

  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-paper p-6" aria-labelledby="change-heading">
      <h2 id="change-heading" className="text-xl">Need to make a change?</h2>
      <p className="mt-1 text-sm text-ink-soft">You can reschedule or cancel yourself up to {p.noticeHours} hours before the start. See our <a className="font-semibold underline" href="/cancellation-policy">cancellation policy</a>.</p>

      {p.canReschedule ? (
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-forest-950">Reschedule</legend>
          <label htmlFor="new-date" className="mt-2 block text-xs font-semibold text-ink-soft">New date</label>
          <input id="new-date" type="date" min={p.minDate} value={date} onChange={(e) => { setDate(e.target.value); setSlotId(""); setSlots(null); }} className="h-11 rounded-[var(--radius-control)] border border-line bg-ivory px-3" />
          {date ? (
            <div className="mt-3" aria-live="polite">
              {slotError ? <p role="alert" className="text-sm font-medium text-danger">Could not check availability. Try the date again.</p> : null}
              {!slots && !slotError ? <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…</p> : null}
              {slots ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  {slots.map((s) => (
                    <label key={s.id} className={cn("flex flex-col rounded-[var(--radius-control)] border px-3 py-2 text-sm", s.available ? "cursor-pointer bg-ivory hover:border-sage-500" : "cursor-not-allowed bg-sand text-ink-mute line-through", slotId === s.id ? "border-forest-700 bg-sage-100" : "border-line")}>
                      <input type="radio" name="new-slot" className="sr-only" disabled={!s.available} checked={slotId === s.id} onChange={() => setSlotId(s.id)} />
                      <span className="font-semibold">{s.label}</span>
                      {!s.available ? <span className="no-underline">{s.reason ?? "Unavailable"}</span> : null}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <Button className="mt-4" size="sm" onClick={reschedule} disabled={!date || !slotId || busy !== null} aria-busy={busy === "reschedule"}>
            {busy === "reschedule" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Confirm new time
          </Button>
        </fieldset>
      ) : p.rescheduleBlockedReason ? <p className="mt-4 text-sm text-ink-soft">{p.rescheduleBlockedReason}</p> : null}

      <div className="mt-6 border-t border-line pt-5">
        {p.canCancel ? (
          confirmingCancel ? (
            <div>
              <label htmlFor="cancel-reason" className="block text-xs font-semibold text-ink-soft">Reason (optional)</label>
              <input id="cancel-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className="mt-1 h-11 w-full rounded-[var(--radius-control)] border border-line bg-ivory px-3" />
              <div className="mt-3 flex gap-3">
                <Button variant="danger" size="sm" onClick={cancel} disabled={busy !== null} aria-busy={busy === "cancel"}>{busy === "cancel" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Yes, cancel my booking</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)} disabled={busy !== null}>Keep booking</Button>
              </div>
            </div>
          ) : <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(true)}>Cancel this booking</Button>
        ) : p.cancelBlockedReason ? <p className="text-sm text-ink-soft">{p.cancelBlockedReason}</p> : null}
      </div>

      {msg ? <p role={msg.ok ? "status" : "alert"} className={cn("mt-4 text-sm font-medium", msg.ok ? "text-forest-700" : "text-danger")}>{msg.text}</p> : null}
    </section>
  );
}
