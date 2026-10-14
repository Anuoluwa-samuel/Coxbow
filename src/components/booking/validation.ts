import type { Service, ServiceArea } from "@/lib/catalog-types";
import { normaliseNigerianPhone } from "@/lib/phone";
import { isServiceable } from "@/lib/service-area";
import type { BookingDraft, Errors } from "./types";

/** Client-side convenience checks. The server re-validates everything. */
export function validateStep(step: number, d: BookingDraft, service: Service | undefined, areas: ServiceArea[]): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!service) e.serviceSlug = "Choose a service";
    if (!d.propertyType) e.propertyType = "Choose a property type";
    if (service?.fields.rooms && d.bedrooms === "") e.bedrooms = "Enter the number of bedrooms (0 if none)";
    if (service?.fields.rooms && d.bathrooms === "") e.bathrooms = "Enter the number of bathrooms";
    if (service?.fields.sizeSqm && d.sizeSqm !== "" && !(Number(d.sizeSqm) >= 1)) e.sizeSqm = "Enter a size in square metres";
    if (service?.fields.materials && !d.materials) e.materials = "Tell us who provides cleaning materials";
  }
  if (step === 1) {
    if (!d.state) e.state = "Select a state";
    if (!d.city) e.city = "Select a city";
    const cityArea = areas.find((a) => a.state === d.state && a.city === d.city);
    if (cityArea && cityArea.neighbourhoods.length && !d.neighbourhood) e.neighbourhood = "Select a neighbourhood";
    if (d.state && d.city && !isServiceable(areas, { state: d.state, city: d.city, neighbourhood: d.neighbourhood || undefined }))
      e.city = e.city ?? "We do not currently serve this location";
    if (d.address.trim().length < 5) e.address = "Enter the service address";
    if (!d.date) e.date = "Choose a date";
    if (!d.timeSlotId) e.timeSlotId = "Choose a time slot";
  }
  if (step === 2) {
    if (d.customerName.trim().length < 2) e.customerName = "Enter your name";
    if (!normaliseNigerianPhone(d.customerPhone)) e.customerPhone = "Enter a valid Nigerian phone number, e.g. 0801 234 5678";
    if (d.customerEmail && !/^\S+@\S+\.\S+$/.test(d.customerEmail)) e.customerEmail = "Enter a valid email address";
    if (!d.consent) e.consent = "You must accept the privacy notice to continue";
  }
  return e;
}
