"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth";
import { runAction, str, nairaToKoboStr, type ActionState } from "@/server/action";
import { createService, updateService, upsertAddon } from "@/server/catalog-admin";

export async function createServiceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const r = await runAction(async () => {
    const actor = await requirePermission("services.write");
    const slug = await createService(db, actor, { name: str(fd, "name"), slug: str(fd, "slug"), categorySlug: str(fd, "category") });
    updateTag("catalog");
    return slug;
  });
  if (r.ok) redirect(`/admin/services/${r.message}`);
  return r;
}

export async function updateServiceAction(slug: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("services.write");
    await updateService(db, actor, slug, {
      name: str(fd, "name"), summary: str(fd, "summary"), description: str(fd, "description"), idealFor: str(fd, "idealFor"),
      includes: str(fd, "includes"), excludes: str(fd, "excludes"), extraCharges: str(fd, "extraCharges"), pricingNote: str(fd, "pricingNote"),
      pricingModel: str(fd, "pricingModel"), baseNaira: str(fd, "baseNaira"), tiers: str(fd, "tiers"),
      minNoticeHours: str(fd, "minNoticeHours"), durationMinutes: str(fd, "durationMinutes"),
      enabled: fd.get("enabled") === "on", popular: fd.get("popular") === "on",
    });
    updateTag("catalog");
    return "Service saved.";
  });
}

export async function upsertAddonAction(slug: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("services.write");
    await upsertAddon(db, actor, slug, { slug: str(fd, "addonSlug"), name: str(fd, "name"), priceKobo: nairaToKoboStr(str(fd, "price") || "0"), enabled: fd.get("enabled") === "on" });
    updateTag("catalog");
    return "Add-on saved.";
  });
}
