import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-8 shadow-card">
        <Logo />
        <h1 className="mt-8 text-2xl">Staff sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">For administrators, managers and cleaners.</p>
        <LoginForm />
      </div>
    </div>
  );
}
