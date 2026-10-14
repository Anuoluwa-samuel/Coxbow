import "server-only";
import { AppError } from "./errors";

export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Wraps a server action body: typed errors become safe messages, anything else is logged generically. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? "Saved." };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
    // Next's redirect()/notFound() work by throwing; they must propagate.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("Action failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const nairaToKoboStr = (v: string) => Math.round(Number(v.replace(/[, ]/g, "")) * 100);
