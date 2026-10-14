"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth";
import { runAction, type ActionState } from "@/server/action";
import { markReconciled } from "@/server/payments";

export async function reconcile(paymentId: string, value: boolean, _p: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("payments.record");
    await markReconciled(db, actor, paymentId, value);
    revalidatePath("/admin/payments");
    return value ? "Marked reconciled." : "Marked unreconciled.";
  });
}
