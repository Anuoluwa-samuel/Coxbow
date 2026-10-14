"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Starts a Paystack checkout for the agreed outstanding amount. The amount is decided by the server. */
export function PayNow({ reference, token, label }: { reference: string; token: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/initialize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, token }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && typeof body.authorizationUrl === "string") {
        window.location.assign(body.authorizationUrl);
        return; // keep the spinner while the browser navigates away
      }
      setError(body.message ?? "We could not start the payment. Nothing was charged.");
    } catch {
      setError("Network problem. Nothing was charged. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <Button size="lg" onClick={start} disabled={busy} aria-busy={busy}>
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Lock className="size-5" aria-hidden />} {label}
      </Button>
      <p className="mt-2 text-xs text-ink-mute">You will be taken to Paystack to pay securely. We never see or store your card details.</p>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
