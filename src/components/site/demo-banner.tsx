import { siteConfig } from "@/lib/site-config";

export function DemoBanner() {
  if (!siteConfig.demoMode) return null;
  return (
    <div role="note" className="bg-brass-soft px-4 py-2 text-center text-xs font-medium text-forest-950">
      Demonstration mode: services, prices, areas and contact details are sample data until the business configures its own.
    </div>
  );
}
