"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReviewForm({ reference, token }: { reference: string; token: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating) return setError("Choose a rating from 1 to 5 stars.");
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(reference)}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, rating, comment: comment || undefined }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { router.refresh(); return; }
      setError(body.message ?? "We could not save your review. Please try again.");
    } catch { setError("Network problem. Your review was not saved."); }
    setBusy(false);
  }

  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-paper p-6" aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-xl">How did we do?</h2>
      <fieldset className="mt-3">
        <legend className="sr-only">Rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brass">
              <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} />
              <Star className={cn("size-8", n <= rating ? "fill-brass text-brass" : "text-ink-mute")} aria-hidden />
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="review-comment" className="mt-4 block text-xs font-semibold text-ink-soft">Comments (optional)</label>
      <textarea id="review-comment" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border border-line bg-ivory p-3 text-sm" />
      <p className="mt-1 text-xs text-ink-mute">Reviews are checked by our team before they appear on the website, with your first name only.</p>
      <Button className="mt-3" size="sm" onClick={submit} disabled={busy} aria-busy={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Send review</Button>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
    </section>
  );
}
