"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth";
import { runAction, str, type ActionState } from "@/server/action";
import { addAvailability, createStaffUser, removeAvailability, setUserActive } from "@/server/staff";

export async function createStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("staff.manage");
    await createStaffUser(db, actor, { fullName: str(fd, "fullName"), email: str(fd, "email"), role: str(fd, "role") || "cleaner", phone: str(fd, "phone") || undefined, password: String(fd.get("password") ?? "") });
    revalidatePath("/admin/staff");
    return "Staff member created. Share the temporary password securely and ask them to keep it private.";
  });
}

export async function toggleActive(userId: string, active: boolean, _p: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("staff.manage");
    await setUserActive(db, actor, userId, active);
    revalidatePath("/admin/staff");
    return active ? "Account reactivated." : "Account deactivated and signed out.";
  });
}

export async function addSlot(staffId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("staff.manage");
    await addAvailability(db, actor, staffId, Number(str(fd, "day")), str(fd, "start"), str(fd, "end"));
    revalidatePath("/admin/staff");
    return "Availability added.";
  });
}

export async function removeSlot(staffId: string, availabilityId: string, _p: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("staff.manage");
    await removeAvailability(db, actor, staffId, availabilityId);
    revalidatePath("/admin/staff");
    return "Removed.";
  });
}
