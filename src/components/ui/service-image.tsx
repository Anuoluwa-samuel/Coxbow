import { PlaceholderImage } from "./placeholder-image";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/catalog-types";

/** The service's real photo when an admin has uploaded one; otherwise the honest placeholder. */
export function ServiceImage({ service, className, priority = false, tone = "sage" }: { service: Pick<Service, "name" | "imageId" | "imageAlt">; className?: string; priority?: boolean; tone?: "sage" | "forest" | "sand" }) {
  if (!service.imageId) return <PlaceholderImage label={service.name} className={className} tone={tone} />;
  return (
    // Plain <img>: photos are served by our own /media route with immutable caching. Aspect ratio comes from the wrapper, so there is no layout shift.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/media/${service.imageId}`}
      alt={service.imageAlt ?? service.name}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("w-full rounded-[var(--radius-card)] object-cover", className)}
    />
  );
}
