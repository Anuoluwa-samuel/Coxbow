"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuotationActions({ reference, token }: { reference: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(reference)}/quotation`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, accept }),
      });
      if (res.ok) { router.refresh(); return; }
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Could not record your response. Please try again.");
    } catch {
      setError("Network problem. Your response was not recorded. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => respond(true)} disabled={busy !== null}>
          {busy === "accept" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Accept quotation
        </Button>
        <Button variant="outline" onClick={() => respond(false)} disabled={busy !== null}>
          {busy === "decline" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Decline
        </Button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
