import type { Metadata } from "next";
import Link from "next/link";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listReviewsForModeration } from "@/server/reviews";
import { ActionForm } from "@/components/admin/action-form";
import { Card, PageTitle } from "@/components/admin/ui";
import { moderate } from "./actions";

export const metadata: Metadata = { title: "Reviews", robots: { index: false } };

export default async function ReviewsAdmin() {
  await requirePagePermission("reviews.moderate");
  const rows = await listReviewsForModeration(db);
  const pending = rows.filter((r) => !r.approved).length;
  return (
    <>
      <PageTitle title="Reviews" sub={`${pending} awaiting approval. Only approved reviews appear on the website, showing the customer's first name.`} />
      <div className="space-y-4">
        {rows.length === 0 ? <Card><p className="text-sm text-ink-soft">No reviews yet. Customers can review a job once it is completed.</p></Card> : null}
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold"><span aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}<span className="text-ink-mute">{"★".repeat(5 - r.rating)}</span></span> <span className="ml-2 text-sm font-normal text-ink-soft">{r.service} · <Link href={`/admin/bookings/${r.bookingId}`} className="underline">{r.reference}</Link></span></p>
                <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm">{r.comment ?? <em className="text-ink-mute">No comment</em>}</p>
                <p className="mt-2 text-xs text-ink-mute">{r.customer} · {r.createdAt.toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" })} · {r.approved ? "Published" : "Pending"}</p>
              </div>
              {r.approved
                ? <ActionForm action={moderate.bind(null, r.id, false)} submitLabel="Hide" variant="outline" className="space-y-0" />
                : <ActionForm action={moderate.bind(null, r.id, true)} submitLabel="Approve and publish" className="space-y-0" />}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
