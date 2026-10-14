"use server";

import { updateTag } from "next/cache";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth";
import { runAction, str, type ActionState } from "@/server/action";
import { updateBookingSettings, updateTimeSlot, upsertArea } from "@/server/catalog-admin";

export async function saveArea(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("areas.write");
    await upsertArea(db, actor, {
      state: str(fd, "state"), city: str(fd, "city"), enabled: fd.get("enabled") === "on",
      neighbourhoods: str(fd, "neighbourhoods").split(",").map((s) => s.trim()).filter(Boolean),
    });
    updateTag("catalog");
    return "Area saved.";
  });
}

export async function saveSlot(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("settings.write");
    await updateTimeSlot(db, actor, id, { capacity: Number(str(fd, "capacity")), enabled: fd.get("enabled") === "on" });
    updateTag("catalog");
    return "Time slot saved.";
  });
}

export async function saveSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("settings.write");
    await updateBookingSettings(db, actor, { operatingDays: fd.getAll("day").map(Number), maxAdvanceDays: Number(str(fd, "maxAdvanceDays")) });
    return "Booking settings saved.";
  });
}
