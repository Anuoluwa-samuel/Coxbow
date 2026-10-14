"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth";
import { runAction, type ActionState } from "@/server/action";
import { setReviewApproved } from "@/server/reviews";

export async function moderate(reviewId: string, approved: boolean, _p: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("reviews.moderate");
    await setReviewApproved(db, actor, z.string().uuid().parse(reviewId), approved);
    updateTag("reviews");
    return approved ? "Review approved and now visible on the site." : "Review hidden.";
  });
}
