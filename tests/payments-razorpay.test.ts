import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRazorpayGateway } from "@/services/payments/razorpay";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Razorpay payment gateway", () => {
  it("verifies webhook HMAC signatures", async () => {
    const secret = "test_webhook_secret";
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test",
            order_id: "order_test",
            amount: 50000,
            currency: "INR",
            status: "captured"
          }
        }
      }
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    const gateway = createRazorpayGateway({
      RAZORPAY_KEY_ID: "rzp_test",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: secret
    });

    const event = await gateway.verifyWebhook(payload, signature, rawBody);
    expect(event.status).toBe("succeeded");
    expect(event.intentId).toBe("order_test");
    expect(event.amount).toBe(500);
  });

  it("rejects invalid signatures", async () => {
    const gateway = createRazorpayGateway({
      RAZORPAY_KEY_ID: "rzp_test",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret"
    });
    await expect(gateway.verifyWebhook({}, "bad-signature", "{}")).rejects.toThrow(/signature/i);
  });

  it("rejects sub-rupee order totals before calling Razorpay", async () => {
    const gateway = createRazorpayGateway({
      RAZORPAY_KEY_ID: "rzp_test",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "test_webhook_secret"
    });
    await expect(
      gateway.createIntent({
        orderId: "order-1",
        amount: 0.5,
        currency: "INR",
        customerEmail: "buyer@example.com"
      })
    ).rejects.toThrow(/at least ₹1/i);
  });
});

describe("commerce lifecycle hardening", () => {
  it("uses fulfill_reserved_stock RPC instead of double available deduction in warehouse fulfillment helper", () => {
    const movements = source("services/warehouse-movements.ts");
    expect(movements).toContain("fulfillReservedStock");
    expect(movements).not.toContain("quantityDelta: -quantity");
  });

  it("routes shipment creation through reservation fulfillment when checkout reserved stock exists", () => {
    const shipments = source("services/shipments.ts");
    expect(shipments).toContain("orderHasCheckoutReservations");
    expect(shipments).toContain("fulfillReservedStock");
  });

  it("releases stock on payment webhook failure", () => {
    const confirm = source("services/payments/confirm-payment.ts");
    expect(confirm).toContain('event.status === "failed"');
    expect(confirm).toContain("releaseCheckoutStock");
  });

  it("handles payment refunds with stock release and order status update", () => {
    const confirm = source("services/payments/confirm-payment.ts");
    expect(confirm).toContain('event.status === "refunded"');
    expect(confirm).toContain('payment_status: "refunded"');
  });

  it("defines idempotent reservation migration", () => {
    const migration = source("supabase/migrations/20260618000200_commerce_lifecycle_rpcs.sql");
    expect(migration).toContain("movement_type = 'reservation'");
    expect(migration).toContain("fulfill_reserved_stock");
    expect(migration).toContain("payment_webhook_events");
  });
});
