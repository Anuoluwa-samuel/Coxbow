"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Shown after Paystack redirects back with ?reference=. We never trust the redirect itself: the server asks
 * Paystack for the real outcome (and the webhook may already have recorded it), then the page refreshes.
 */
export function PaymentReturn({ bookingReference, token, paymentReference }: { bookingReference: string; token: string; paymentReference: string }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "success" | "failed" | "pending" | "error">("checking");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingReference, token, paymentReference }) })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!ok) return setState("error");
        const o = b.outcome as string;
        setState(o === "success" || o === "already_processed" ? "success" : o === "failed" ? "failed" : "pending");
        // Refresh server data (balance, status) but keep this message on screen. Re-verifying is idempotent.
        router.refresh();
      })
      .catch(() => setState("error"));
  }, [bookingReference, token, paymentReference, router]);

  const text = {
    checking: "Confirming your payment with Paystack…",
    success: "Payment received. Thank you!",
    failed: "The payment was not completed and you have not been charged. You can try again below.",
    pending: "Your payment is still being processed. This page will update; you can also check back shortly.",
    error: "We could not confirm the payment right now. If you were charged, it will be recorded automatically; otherwise please contact us.",
  }[state];

  return (
    <div role="status" className="mt-6 flex items-center gap-3 rounded-[var(--radius-control)] bg-sage-100 p-4 text-sm font-medium">
      {state === "checking" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {text}
    </div>
  );
}
