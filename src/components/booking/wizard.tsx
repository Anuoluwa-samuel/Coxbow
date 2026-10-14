"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Service, ServiceArea, TimeSlot } from "@/lib/catalog-types";
import { Progress } from "./progress";
import { StepService } from "./step-service";
import { StepSchedule } from "./step-schedule";
import { StepCustomer } from "./step-customer";
import { StepReview } from "./step-review";
import { validateStep } from "./validation";
import { STEPS, type BookingDraft, type Errors, type SlotInfo } from "./types";

interface Props {
  services: Service[];
  areas: ServiceArea[];
  timeSlots: TimeSlot[];
  minDate: string;
  initialService?: string;
  initialCity?: string; // "City, State"
}

function initialDraft(p: Props): BookingDraft {
  const [city = "", state = ""] = (p.initialCity ?? "").split(",").map((s) => s.trim());
  const known = p.areas.some((a) => a.city === city && a.state === state);
  return {
    serviceSlug: p.services.some((s) => s.slug === p.initialService) ? (p.initialService as string) : "",
    propertyType: "", bedrooms: "", bathrooms: "", sizeSqm: "", addonSlugs: [], materials: "", instructions: "",
    state: known ? state : "", city: known ? city : "", neighbourhood: "", address: "", accessInstructions: "",
    date: "", timeSlotId: "", frequency: "one_off",
    customerName: "", customerPhone: "", customerEmail: "", consent: false,
  };
}

export function BookingWizard(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>(() => initialDraft(props));
  const [errors, setErrors] = useState<Errors>({});
  const [slotResult, setSlotResult] = useState<{ key: string; slots?: SlotInfo[]; error?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // One key per wizard session: retries and double-clicks cannot create a second booking.
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const service = useMemo(() => props.services.find((s) => s.slug === draft.serviceSlug), [props.services, draft.serviceSlug]);
  const slot = props.timeSlots.find((t) => t.id === draft.timeSlotId);

  const set = useCallback(<K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  // Availability is always fetched from the server for the chosen service and date.
  // Loading is derived: a result that does not match the current key means "in flight".
  const slotKey = draft.date && draft.serviceSlug ? `${draft.serviceSlug}|${draft.date}` : "";
  useEffect(() => {
    if (!slotKey) return;
    const ctrl = new AbortController();
    fetch(`/api/availability?service=${encodeURIComponent(draft.serviceSlug)}&date=${draft.date}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { slots: SlotInfo[] }) => setSlotResult({ key: slotKey, slots: data.slots }))
      .catch((err) => { if (err?.name !== "AbortError") setSlotResult({ key: slotKey, error: true }); });
    return () => ctrl.abort();
  }, [slotKey, draft.serviceSlug, draft.date]);
  const slotCurrent = slotResult?.key === slotKey ? slotResult : null;
  const slots = slotCurrent?.slots ?? [];
  const slotsState: "idle" | "loading" | "error" | "ready" = !slotKey ? "idle" : !slotCurrent ? "loading" : slotCurrent.error ? "error" : "ready";

  useEffect(() => { headingRef.current?.focus(); }, [step]);

  function next() {
    const e = validateStep(step, draft, service, props.areas);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  }

  async function submit() {
    if (submitting || !service) return;
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      idempotencyKey: idempotencyKey.current,
      serviceSlug: draft.serviceSlug,
      propertyType: draft.propertyType,
      bedrooms: draft.bedrooms === "" ? undefined : Number(draft.bedrooms),
      bathrooms: draft.bathrooms === "" ? undefined : Number(draft.bathrooms),
      sizeSqm: draft.sizeSqm === "" ? undefined : Number(draft.sizeSqm),
      addonSlugs: draft.addonSlugs,
      materials: draft.materials || undefined,
      instructions: draft.instructions || undefined,
      state: draft.state, city: draft.city, neighbourhood: draft.neighbourhood || undefined,
      address: draft.address, accessInstructions: draft.accessInstructions || undefined,
      date: draft.date, timeSlotId: draft.timeSlotId, frequency: draft.frequency,
      customerName: draft.customerName, customerPhone: draft.customerPhone,
      customerEmail: draft.customerEmail || undefined, consent: draft.consent,
    };
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.reference) {
        // Success is shown only after the server confirms the booking was saved.
        router.push(`/book/confirmation/${body.reference}?t=${encodeURIComponent(body.accessToken)}`);
        return;
      }
      if (res.status === 409 && body.code === "slot_unavailable") {
        setSubmitError("That time slot was just taken. Please choose another.");
        setStep(1);
        setDraft((d) => ({ ...d, timeSlotId: "" }));
      } else if (res.status === 422 && body.fieldErrors) {
        setSubmitError("Some details need attention: " + Object.values(body.fieldErrors).flat().join(" "));
      } else if (res.status === 429) {
        setSubmitError("Too many attempts. Please wait a minute and try again.");
      } else {
        setSubmitError(body.message ?? "We could not save your booking. Nothing was submitted. Please try again.");
      }
    } catch {
      setSubmitError("Network problem. Nothing was submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepProps = { draft, errors, set };
  const isQuote = service ? ["inspection", "corporate_quote"].includes(service.pricing.model) : false;

  return (
    <div className="mx-auto max-w-2xl">
      <Progress current={step} />
      <h1 ref={headingRef} tabIndex={-1} className="mt-8 text-3xl outline-none sm:text-4xl">
        {step === 0 && "Tell us what you need"}
        {step === 1 && "Where and when?"}
        {step === 2 && "Your contact details"}
        {step === 3 && (isQuote ? "Review your quotation request" : "Review your booking")}
      </h1>
      <div className="mt-8">
        {step === 0 && <StepService {...stepProps} services={props.services} service={service} />}
        {step === 1 && <StepSchedule {...stepProps} areas={props.areas} service={service} slots={slots} slotsState={slotsState} minDate={props.minDate} />}
        {step === 2 && <StepCustomer {...stepProps} />}
        {step === 3 && service && <StepReview draft={draft} service={service} slot={slot} />}
      </div>

      {submitError ? <p role="alert" className="mt-6 rounded-[var(--radius-control)] bg-danger-soft p-4 text-sm font-medium text-danger">{submitError}</p> : null}

      <div className="mt-10 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}><ArrowLeft className="size-4" aria-hidden /> Back</Button>
        ) : <span />}
        {step < STEPS.length - 1 ? (
          <Button size="lg" onClick={next}>Continue <ArrowRight className="size-5" aria-hidden /></Button>
        ) : (
          <Button size="lg" onClick={submit} disabled={submitting} aria-busy={submitting}>
            {submitting ? <><Loader2 className="size-5 animate-spin" aria-hidden /> Submitting…</> : isQuote ? "Request quotation" : "Submit booking request"}
          </Button>
        )}
      </div>
    </div>
  );
}
