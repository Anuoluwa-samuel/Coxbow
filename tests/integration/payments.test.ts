import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { createBooking } from "@/server/bookings";
import { transitionBooking } from "@/server/workflow";
import { handlePaystackWebhook, initializePayment, markReconciled, paymentSummary, recordManualPayment, recordRefund, verifyAndApplyPayment } from "@/server/payments";
import { dispatchPending, type EmailMessage } from "@/server/notifications";
import type { PaystackClient, PaystackVerifyData } from "@/server/paystack";
import type { AppError } from "@/server/errors";
import { NOW, bookingPayload, makeUser, resetDb } from "./helpers";

const SECRET = "sk_test_unit_secret";
beforeEach(async () => { await resetDb({ slotCapacity: 5 }); process.env.PAYSTACK_SECRET_KEY = SECRET; });

const code = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e) as AppError | null)?.code;
const sign = (body: string) => createHmac("sha512", SECRET).update(body).digest("hex");

/** Fake provider: records calls and returns whatever `remote` says (the "truth" at Paystack). */
function fakePaystack(remote: Partial<PaystackVerifyData> = {}) {
  const verify = vi.fn(async (reference: string): Promise<PaystackVerifyData> => ({ status: "success", reference, amount: 0, currency: "NGN", id: 777, ...remote }));
  const initialize = vi.fn(async () => ({ authorizationUrl: "https://checkout.example/pay" }));
  return { client: { initialize, verify } as PaystackClient, verify, initialize };
}

async function confirmedBooking(email: string | null = "ada@example.test") {
  const r = await createBooking(db, bookingPayload({ customerEmail: email ?? undefined }), NOW);
  const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.reference, r.reference));
  await transitionBooking(db, await makeUser("manager"), b.id, "confirmed");
  return { ...r, id: b.id, finalKobo: b.estimateKobo! };
}

async function pendingPayment() {
  const b = await confirmedBooking();
  const fp = fakePaystack({ amount: b.finalKobo });
  const init = await initializePayment(db, fp.client, b.reference, b.accessToken, "http://site.test");
  return { b, fp, ref: init.paymentReference };
}

describe("initializing a payment", () => {
  it("charges the agreed price from the database, not from the browser", async () => {
    const { b, fp, ref } = await pendingPayment();
    expect(fp.initialize).toHaveBeenCalledWith(expect.objectContaining({ amountKobo: b.finalKobo, reference: ref, email: "ada@example.test" }));
    const [p] = await db.select().from(schema.payments);
    expect(p).toMatchObject({ status: "pending", amountKobo: b.finalKobo, verifiedAt: null });
  });
  it("refuses unconfirmed bookings, wrong tokens, missing emails and fully paid bookings", async () => {
    const fp = fakePaystack();
    const unconfirmed = await createBooking(db, bookingPayload({ customerEmail: "a@example.test" }), NOW);
    expect(await code(initializePayment(db, fp.client, unconfirmed.reference, unconfirmed.accessToken, "http://x"))).toBe("conflict");
    const b = await confirmedBooking();
    expect(await code(initializePayment(db, fp.client, b.reference, "wrong-token-value", "http://x"))).toBe("not_found");
    const noEmail = await confirmedBooking(null);
    expect(await code(initializePayment(db, fp.client, noEmail.reference, noEmail.accessToken, "http://x"))).toBe("validation");
    await recordManualPayment(db, await makeUser("manager"), b.id, b.finalKobo, "cash");
    expect(await code(initializePayment(db, fp.client, b.reference, b.accessToken, "http://x"))).toBe("conflict");
    expect(fp.initialize).not.toHaveBeenCalled();
  });
});

describe("verification", () => {
  it("is never successful until the provider confirms it", async () => {
    const { fp, ref } = await pendingPayment();
    expect((await db.select().from(schema.payments))[0].status).toBe("pending");
    const pending = fakePaystack({ status: "ongoing", amount: fp.verify.mock.calls.length });
    expect(await verifyAndApplyPayment(db, pending.client, ref)).toBe("pending");
    expect((await db.select().from(schema.payments))[0]).toMatchObject({ status: "pending", verifiedAt: null });
  });
  it("marks success with a verification timestamp when provider, reference, currency and amount match", async () => {
    const { b, fp, ref } = await pendingPayment();
    expect(await verifyAndApplyPayment(db, fp.client, ref)).toBe("success");
    const [p] = await db.select().from(schema.payments);
    expect(p.status).toBe("success");
    expect(p.verifiedAt).not.toBeNull();
    expect((await paymentSummary(db, b.id)).outstandingKobo).toBe(0);
  });
  it("rejects an amount or currency that differs from our record", async () => {
    const { b, ref } = await pendingPayment();
    expect(await verifyAndApplyPayment(db, fakePaystack({ amount: 100 }).client, ref)).toBe("mismatch");
    expect(await verifyAndApplyPayment(db, fakePaystack({ amount: b.finalKobo, currency: "USD" }).client, ref)).toBe("mismatch");
    expect((await db.select().from(schema.payments))[0].status).toBe("pending");
  });
  it("records provider failure without crediting anything", async () => {
    const { b, ref } = await pendingPayment();
    expect(await verifyAndApplyPayment(db, fakePaystack({ status: "failed", amount: b.finalKobo }).client, ref)).toBe("failed");
    expect((await paymentSummary(db, b.id)).paidKobo).toBe(0);
  });
  it("the database itself refuses a 'success' row with no verification", async () => {
    const { ref } = await pendingPayment();
    await expect(db.update(schema.payments).set({ status: "success" }).where(eq(schema.payments.reference, ref))).rejects.toThrow();
  });
  it("is idempotent, even when verified concurrently", async () => {
    const { b, fp, ref } = await pendingPayment();
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyAndApplyPayment(db, fp.client, ref)));
    expect(results.filter((r) => r === "success")).toHaveLength(1);
    expect((await paymentSummary(db, b.id)).paidKobo).toBe(b.finalKobo);
  });
});

describe("webhooks", () => {
  const event = (reference: string, id = 1001) => JSON.stringify({ event: "charge.success", data: { id, reference } });

  it("rejects forged, missing and wrong-secret signatures without changing anything", async () => {
    const { fp, ref } = await pendingPayment();
    const body = event(ref);
    expect(await code(handlePaystackWebhook(db, fp.client, body, null))).toBe("unauthorized");
    expect(await code(handlePaystackWebhook(db, fp.client, body, "deadbeef"))).toBe("unauthorized");
    expect(await code(handlePaystackWebhook(db, fp.client, body, createHmac("sha512", "other").update(body).digest("hex")))).toBe("unauthorized");
    expect(await code(handlePaystackWebhook(db, fp.client, body + " ", sign(body)))).toBe("unauthorized"); // body altered after signing
    expect((await db.select().from(schema.payments))[0].status).toBe("pending");
    expect(await db.select().from(schema.paymentEvents)).toHaveLength(0);
  });

  it("processes a valid event once; replays are no-ops and never credit twice", async () => {
    const { b, fp, ref } = await pendingPayment();
    const body = event(ref);
    const first = await handlePaystackWebhook(db, fp.client, body, sign(body));
    expect(first.duplicate).toBe(false);
    for (let i = 0; i < 4; i++) expect((await handlePaystackWebhook(db, fp.client, body, sign(body))).duplicate).toBe(true);
    expect(fp.verify).toHaveBeenCalledTimes(1);
    expect((await db.select().from(schema.paymentEvents))).toHaveLength(1);
    expect((await paymentSummary(db, b.id)).paidKobo).toBe(b.finalKobo);
  });

  it("handles simultaneous duplicate deliveries safely", async () => {
    const { b, fp, ref } = await pendingPayment();
    const body = event(ref, 2002);
    await Promise.all(Array.from({ length: 6 }, () => handlePaystackWebhook(db, fp.client, body, sign(body))));
    expect((await paymentSummary(db, b.id)).paidKobo).toBe(b.finalKobo);
    expect(await db.select().from(schema.payments)).toHaveLength(1);
  });

  it("does not trust the webhook payload: provider verification decides", async () => {
    const { ref } = await pendingPayment();
    const liar = fakePaystack({ status: "failed" }); // payload says success, provider says failed
    const body = event(ref, 3003);
    await handlePaystackWebhook(db, liar.client, body, sign(body));
    expect((await db.select().from(schema.payments))[0].status).toBe("failed");
  });

  it("ignores events for unknown references and non-charge events", async () => {
    const fp = fakePaystack();
    const b1 = event("CXP-unknown");
    await handlePaystackWebhook(db, fp.client, b1, sign(b1));
    const b2 = JSON.stringify({ event: "transfer.success", data: { id: 5 } });
    await handlePaystackWebhook(db, fp.client, b2, sign(b2));
    expect(fp.verify).not.toHaveBeenCalled();
  });
});

describe("manual payments, refunds and permissions", () => {
  it("lets managers record cash payments but not beyond the balance, and audits it", async () => {
    const b = await confirmedBooking();
    const manager = await makeUser("manager");
    expect(await code(recordManualPayment(db, manager, b.id, b.finalKobo + 1, "x"))).toBe("validation");
    expect(await code(recordManualPayment(db, await makeUser("cleaner"), b.id, 100, "x"))).toBe("forbidden");
    await recordManualPayment(db, manager, b.id, 1_000_000, "cash deposit");
    expect((await paymentSummary(db, b.id)).outstandingKobo).toBe(b.finalKobo - 1_000_000);
    expect((await db.select().from(schema.auditLogs)).some((l) => l.action === "payment.manual_recorded")).toBe(true);
  });
  it("restricts refunds to admins, verified payments and refundable amounts", async () => {
    const b = await confirmedBooking();
    const p = await recordManualPayment(db, await makeUser("manager"), b.id, b.finalKobo, "transfer");
    expect(await code(recordRefund(db, await makeUser("manager"), p.id, 100, "x"))).toBe("forbidden");
    const admin = await makeUser("admin");
    expect(await code(recordRefund(db, admin, p.id, b.finalKobo + 1, "x"))).toBe("validation");
    expect(await code(recordRefund(db, admin, p.id, 100, " "))).toBe("validation");
    await recordRefund(db, admin, p.id, 500_000, "Partial service");
    expect((await db.select().from(schema.payments).where(eq(schema.payments.id, p.id)))[0].status).toBe("partially_refunded");
    await recordRefund(db, admin, p.id, b.finalKobo - 500_000, "Rest");
    expect((await db.select().from(schema.payments).where(eq(schema.payments.id, p.id)))[0].status).toBe("refunded");
    expect(await code(recordRefund(db, admin, p.id, 1, "again"))).toBe("conflict"); // fully refunded: nothing left to refund
    expect((await paymentSummary(db, b.id)).netPaidKobo).toBe(0);
  });
  it("cannot refund an unverified pending payment", async () => {
    const { ref } = await pendingPayment();
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.reference, ref));
    expect(await code(recordRefund(db, await makeUser("admin"), p.id, 100, "x"))).toBe("conflict");
  });
  it("reconciliation is permission-protected and audited", async () => {
    const b = await confirmedBooking();
    const p = await recordManualPayment(db, await makeUser("manager"), b.id, 100_000, "cash");
    expect(await code(markReconciled(db, await makeUser("cleaner"), p.id, true))).toBe("forbidden");
    await markReconciled(db, await makeUser("admin"), p.id, true);
    expect((await db.select().from(schema.payments).where(eq(schema.payments.id, p.id)))[0].reconciled).toBe(true);
  });
});

describe("notifications", () => {
  it("sends each queued email exactly once, with the private link, and records failures", async () => {
    await createBooking(db, bookingPayload({ customerEmail: "ada@example.test" }), NOW);
    const sent: EmailMessage[] = [];
    const provider = { send: async (m: EmailMessage) => { sent.push(m); } };
    const [a, b] = await Promise.all([dispatchPending(db, "http://site.test", provider), dispatchPending(db, "http://site.test", provider)]);
    expect(a.sent + b.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(/http:\/\/site\.test\/book\/confirmation\/CXB-[A-Z2-9]{8}\?t=/);
    expect((await db.select().from(schema.notifications))[0].status).toBe("sent");

    await createBooking(db, bookingPayload({ customerEmail: "bob@example.test" }), NOW);
    await dispatchPending(db, "http://site.test", { send: async () => { throw new Error("provider down"); } });
    const failed = (await db.select().from(schema.notifications)).filter((n) => n.status === "failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toMatch(/provider down/);
  });
});
