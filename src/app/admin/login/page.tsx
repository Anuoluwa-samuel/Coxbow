import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-sage-100 via-ivory to-sky-100 px-4 py-10">
      <div aria-hidden className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-white shadow-card"><Sparkles className="size-10 text-forest-800" /></div>
      <Logo />
      <p className="mt-1 text-sm text-ink-soft">Staff area</p>
      <div className="mt-6 w-full max-w-sm rounded-[1.75rem] border border-line/70 bg-paper p-8 shadow-card">
        <h1 className="text-2xl">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-soft">Sign in to manage bookings, schedules and customers.</p>
        <LoginForm />
      </div>
    </div>
  );
}
