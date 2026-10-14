import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label={`${siteConfig.name} home`}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={light ? "#ffffff" : "#2563eb"} />
        {/* A house with a sparkle: a clean home. */}
        <path d="M7.5 16 16 8.5 24.5 16v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" fill="none" stroke={light ? "#2563eb" : "#ffffff"} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M16 13.2l1.1 2.6 2.6 1.1-2.6 1.1L16 20.6l-1.1-2.6-2.6-1.1 2.6-1.1z" fill="#f2b705" />
      </svg>
      <span className={cn("font-display text-xl font-extrabold tracking-tight", light ? "text-white" : "text-forest-950")}>
        {siteConfig.name}
      </span>
    </Link>
  );
}
