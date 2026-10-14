/**
 * Business-specific details are configuration, not code. Every value here is a
 * placeholder until the business owner supplies the real one via environment
 * variables (or, later, the admin settings table).
 */
const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;

export const siteConfig = {
  name: env("NEXT_PUBLIC_SITE_NAME", "Coxbow"),
  tagline: "Cleaning for homes and workplaces",
  url: env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  // PLACEHOLDERS: replace via environment variables before launch.
  phone: env("NEXT_PUBLIC_CONTACT_PHONE", "+234 000 000 0000"),
  phoneIsPlaceholder: !process.env.NEXT_PUBLIC_CONTACT_PHONE,
  whatsapp: env("NEXT_PUBLIC_WHATSAPP_NUMBER", ""), // digits only, e.g. 2348012345678
  email: env("NEXT_PUBLIC_CONTACT_EMAIL", "hello@example.com"),
  address: env("NEXT_PUBLIC_BUSINESS_ADDRESS", "Business address to be confirmed"),
  hours: env("NEXT_PUBLIC_BUSINESS_HOURS", "Hours to be confirmed"),
  timezone: "Africa/Lagos",
  demoMode: env("NEXT_PUBLIC_DEMO_MODE", "true") === "true",
  social: {
    instagram: env("NEXT_PUBLIC_SOCIAL_INSTAGRAM", ""),
    facebook: env("NEXT_PUBLIC_SOCIAL_FACEBOOK", ""),
    x: env("NEXT_PUBLIC_SOCIAL_X", ""),
  },
} as const;

export function whatsappLink(message?: string): string | null {
  if (!siteConfig.whatsapp) return null;
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${siteConfig.whatsapp}${q}`;
}

export function telLink(): string {
  return `tel:${siteConfig.phone.replace(/[^\d+]/g, "")}`;
}
