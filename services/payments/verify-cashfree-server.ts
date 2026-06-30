import { inrAmountsMatch } from "./amount";
import { createCashfreeGateway } from "./cashfree";
import { logPaymentEvent } from "./logger";
import type { PaymentEvent } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type VerifyCashfreeServerInput = {
  internalOrderId: string;
  cashfreeOrderId: string;
  expectedAmountInr: number;
  expectedCurrency: string;
};

export async function verifyCashfreePaymentOnServer(
  input: VerifyCashfreeServerInput,
  env: Record<string, string | undefined> = process.env
): Promise<PaymentEvent> {
  const intentId = input.cashfreeOrderId.trim();
  if (!intentId) {
    throw new Error("Cashfree order id is required.");
  }

  const gateway = createCashfreeGateway(env);
  const expectedCurrency = input.expectedCurrency.trim().toUpperCase();
  const maxAttempts = 10;
  const delayMs = 2000;

  let lastEvent: PaymentEvent | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const event = await gateway.fetchPaymentStatus(intentId);
    lastEvent = event;

    const eventCurrency = String(event.currency ?? "INR").trim().toUpperCase();
    if (eventCurrency !== expectedCurrency) {
      throw new Error("Payment currency mismatch.");
    }

    if (
      event.amount > 0
      && !inrAmountsMatch(input.expectedAmountInr, event.amount)
    ) {
      if (event.status !== "succeeded") {
        await sleep(delayMs);
        continue;
      }
      throw new Error("Payment amount mismatch.");
    }

    if (event.status === "succeeded") {
      logPaymentEvent("cashfree_gateway_status_resolved", {
        orderId: input.internalOrderId,
        providerIntentId: intentId,
        gatewayStatus: "succeeded",
        mappedStatus: event.status,
        attempt
      });
      return event;
    }

    if (event.status === "failed" || event.status === "refunded") {
      logPaymentEvent("cashfree_gateway_status_resolved", {
        orderId: input.internalOrderId,
        providerIntentId: intentId,
        gatewayStatus: event.status,
        mappedStatus: event.status,
        attempt
      });
      return event;
    }

    await sleep(delayMs);
  }

  logPaymentEvent("cashfree_gateway_status_resolved", {
    orderId: input.internalOrderId,
    providerIntentId: intentId,
    gatewayStatus: lastEvent?.status ?? "unknown",
    mappedStatus: lastEvent?.status ?? "requires_payment",
    attempt: maxAttempts
  });

  return (
    lastEvent ?? {
      provider: "cashfree",
      intentId,
      status: "requires_payment",
      amount: input.expectedAmountInr,
      currency: expectedCurrency,
      raw: {}
    }
  );
}
