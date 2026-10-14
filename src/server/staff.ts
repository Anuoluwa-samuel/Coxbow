import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db/client";
import { staffAvailability, staffProfiles, users } from "./db/schema";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { hashPassword, MIN_PASSWORD_LENGTH } from "./passwords";
import { revokeUserSessions, type SessionUser } from "./auth-core";
import { can } from "@/lib/permissions";
import { normaliseNigerianPhone } from "@/lib/phone";

type Actor = Pick<SessionUser, "id" | "role">;

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["admin", "manager", "cleaner"]),
  phone: z.string().trim().optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`).max(200),
});

/**
 * Managers may create cleaners. Creating managers or admins needs the broader "users.manage" permission,
 * so a manager cannot grant themselves or others more power.
 */
export async function createStaffUser(db: Db, actor: Actor, raw: unknown) {
  if (!can(actor.role, "staff.manage")) throw new AppError("forbidden", "You do not have permission to do that");
  const p = createSchema.safeParse(raw);
  if (!p.success) throw new AppError("validation", "Check the highlighted fields", Object.fromEntries(p.error.issues.map((i) => [i.path.join("."), [i.message]])));
  const v = p.data;
  if (v.role !== "cleaner" && !can(actor.role, "users.manage")) throw new AppError("forbidden", "Only administrators can create managers or administrators");
  let phone: string | null = null;
  if (v.phone) {
    phone = normaliseNigerianPhone(v.phone);
    if (!phone) throw new AppError("validation", "Enter a valid Nigerian phone number", { phone: ["Invalid"] });
  }
  try {
    return await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email: v.email, passwordHash: await hashPassword(v.password), fullName: v.fullName, role: v.role }).returning({ id: users.id });
      let staffId: string | null = null;
      if (v.role === "cleaner") {
        const [s] = await tx.insert(staffProfiles).values({ userId: u.id, phone }).returning({ id: staffProfiles.id });
        staffId = s.id;
      }
      await writeAudit(tx, actor.id, "user.create", "user", u.id, { role: v.role });
      return { userId: u.id, staffId };
    });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new AppError("conflict", "A user with that email already exists");
    throw e;
  }
}

export async function setUserActive(db: Db, actor: Actor, userId: string, active: boolean) {
  if (!can(actor.role, "staff.manage")) throw new AppError("forbidden", "You do not have permission to do that");
  if (userId === actor.id) throw new AppError("validation", "You cannot deactivate your own account");
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new AppError("not_found", "User not found");
  if (target.role !== "cleaner" && !can(actor.role, "users.manage")) throw new AppError("forbidden", "Only administrators can change managers or administrators");
  await db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.update(staffProfiles).set({ active }).where(eq(staffProfiles.userId, userId));
  if (!active) await revokeUserSessions(db, userId);
  await writeAudit(db, actor.id, active ? "user.activate" : "user.deactivate", "user", userId);
}

export async function addAvailability(db: Db, actor: Actor, staffId: string, dayOfWeek: number, start: string, end: string) {
  if (!can(actor.role, "staff.manage")) throw new AppError("forbidden", "You do not have permission to do that");
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new AppError("validation", "Invalid day");
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) throw new AppError("validation", "End time must be after start time");
  await db.insert(staffAvailability).values({ staffId, dayOfWeek, startTime: start, endTime: end });
  await writeAudit(db, actor.id, "staff.availability_add", "staff", staffId, { dayOfWeek, start, end });
}

export async function removeAvailability(db: Db, actor: Actor, staffId: string, availabilityId: string) {
  if (!can(actor.role, "staff.manage")) throw new AppError("forbidden", "You do not have permission to do that");
  await db.delete(staffAvailability).where(and(eq(staffAvailability.id, availabilityId), eq(staffAvailability.staffId, staffId)));
  await writeAudit(db, actor.id, "staff.availability_remove", "staff", staffId);
}
