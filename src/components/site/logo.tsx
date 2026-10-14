import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label={`${siteConfig.name} home`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? "#faf7f0" : "#1d4a38"} />
        {/* An oxbow: a river bend that closes on itself. */}
        <path d="M9 22c0-8 4-12 7-12s7 4 7 12" fill="none" stroke={light ? "#1d4a38" : "#faf7f0"} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="16" cy="22" r="2.4" fill="#b5833a" />
      </svg>
      <span className={cn("font-display text-xl font-medium tracking-tight", light ? "text-ivory" : "text-forest-950")}>
        {siteConfig.name}
      </span>
    </Link>
  );
}
