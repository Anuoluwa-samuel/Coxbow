import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";
import { listServices } from "@/server/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const services = await listServices();
  const paths = ["", "/services", "/book", "/about", "/gallery", "/contact", "/corporate", "/faqs", "/privacy", "/terms", "/cancellation-policy"];
  return [
    ...paths.map((p) => ({ url: `${siteConfig.url}${p}`, changeFrequency: "weekly" as const })),
    ...services.map((s) => ({ url: `${siteConfig.url}/services/${s.slug}`, changeFrequency: "weekly" as const })),
  ];
}
