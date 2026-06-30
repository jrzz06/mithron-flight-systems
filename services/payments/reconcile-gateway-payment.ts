import { createCashfreeGateway } from "./cashfree";
import { logPaymentEvent } from "./logger";
import { reconcileRazorpayOrderPayment } from "./razorpay-payment-resolution";
import type { PaymentEvent, PaymentProviderId } from "./types";

export type ReconcileGatewayPaymentInput = {
  provider: PaymentProviderId;
  intentId: string;
  expectedAmountInr?: number;
  expectedCurrency?: string;
  maxAttempts?: number;
  delayMs?: number;
};

export async function reconcilePaymentWithGateway(
  input: ReconcileGatewayPaymentInput,
  env: Record<string, string | undefined> = process.env
): Promise<PaymentEvent | null> {
  const intentId = input.intentId.trim();
  if (!intentId) return null;

  if (input.provider === "razorpay") {
    return reconcileRazorpayOrderPayment(intentId, env, {
      expectedAmountInr: input.expectedAmountInr,
      expectedCurrency: input.expectedCurrency,
      maxAttempts: input.maxAttempts,
      delayMs: input.delayMs
    });
  }

  if (input.provider === "cashfree") {
    const gateway = createCashfreeGateway(env);
    const maxAttempts = input.maxAttempts ?? 10;
    const delayMs = input.delayMs ?? 2000;
    let lastEvent: PaymentEvent | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const event = await gateway.fetchPaymentStatus(intentId);
      lastEvent = event;

      if (event.status === "succeeded" || event.status === "failed" || event.status === "refunded") {
        logPaymentEvent("cashfree_reconcile_resolved", {
          intentId,
          status: event.status,
          attempt
        });
        return event;
      }

      if (event.status === "processing") {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return lastEvent;
  }

  return null;
}

export function hasSuccessfulGatewayPayment(event: PaymentEvent | null | undefined) {
  return event?.status === "succeeded";
}

export function isPendingGatewayPayment(event: PaymentEvent | null | undefined) {
  return event?.status === "requires_payment" || event?.status === "processing";
}
