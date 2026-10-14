/** Errors safe to show to the client. Anything else is logged and replaced with a generic message. */
export class AppError extends Error {
  constructor(
    public readonly code:
      | "validation" | "not_found" | "forbidden" | "unauthorized" | "conflict"
      | "slot_unavailable" | "not_serviceable" | "invalid_transition" | "rate_limited",
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
  get status(): number {
    return { validation: 422, not_found: 404, forbidden: 403, unauthorized: 401, conflict: 409, slot_unavailable: 409, not_serviceable: 422, invalid_transition: 409, rate_limited: 429 }[this.code];
  }
}
