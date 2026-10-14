"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface Flash { message: string; ok: boolean; id: number }
const Ctx = createContext<(m: Omit<Flash, "id">) => void>(() => undefined);

/**
 * Page-level confirmation banner. Action forms often disappear after success (for example the
 * "Approve" button once a booking is confirmed), so their inline message would vanish with them.
 */
export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const show = useCallback((m: Omit<Flash, "id">) => setFlash({ ...m, id: Date.now() }), []);
  return (
    <Ctx.Provider value={show}>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        {flash ? (
          <div
            key={flash.id}
            role={flash.ok ? "status" : "alert"}
            className={cn("pointer-events-auto flex max-w-lg items-start gap-3 rounded-[var(--radius-control)] px-4 py-3 text-sm font-medium shadow-card", flash.ok ? "bg-forest-900 text-ivory" : "bg-danger text-white")}
          >
            <span>{flash.message}</span>
            <button type="button" onClick={() => setFlash(null)} className="-mr-1 rounded px-1 opacity-80 hover:opacity-100" aria-label="Dismiss message">×</button>
          </div>
        ) : null}
      </div>
      {children}
    </Ctx.Provider>
  );
}

export const useFlash = () => useContext(Ctx);
