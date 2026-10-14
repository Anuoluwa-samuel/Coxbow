"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginAction } from "./actions";

const wrap = "relative";
const input = "h-12 w-full rounded-[var(--radius-control)] border border-line bg-ivory pl-11 pr-3 text-charcoal transition-colors hover:border-sage-500 focus:border-forest-700 focus:outline-none";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { ok: true });
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-forest-950">Email</label>
        <div className={wrap}><Mail aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-mute" /><input id="email" name="email" type="email" autoComplete="username" required className={input} /></div>
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-forest-950">Password</label>
        <div className={wrap}>
          <Lock aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-mute" />
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={`${input} pr-12`} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-mute hover:bg-sage-100">
            {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {!state.ok && state.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Sign in
      </Button>
    </form>
  );
}
