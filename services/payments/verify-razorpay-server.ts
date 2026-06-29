import { createHmac, timingSafeEqual } from "node:crypto";
import { inrAmountsMatch, inrToPaise } from "./amount";
import { logPaymentEvent, logPaymentWarning } from "./logger";
import type { PaymentEvent } from "./types";

type JsonRecord = Record<string, unknown>;

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  captured?: boolean;
};

function envCredentials(env: Record<string, string | undefined>) {
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials are not configured.");
  }
  return { keyId, keySecret };
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature.trim(), "utf8");
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    throw new Error("Invalid Razorpay payment signature.");
  }
}

function mapGatewayPaymentStatus(status?: string): PaymentEvent["status"] {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "failed") return "failed";
  if (normalized === "refunded") return "refunded";
  if (normalized === "captured" || normalized === "paid" || normalized === "authorized") return "succeeded";
  return "requires_payment";
}

async function fetchRazorpayPayment(
  paymentId: string,
  env: Record<string, string | undefined>
): Promise<RazorpayPaymentEntity> {
  const { keyId, keySecret } = envCredentials(env);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Razorpay payment lookup failed (${response.status}).`);
  }

  return (await response.json()) as RazorpayPaymentEntity;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveGatewayPayment(
  paymentId: string,
  razorpayOrderId: string,
  env: Record<string, string | undefined>
) {
  let payment = await fetchRazorpayPayment(paymentId, env);
  if (String(payment.order_id ?? "") !== razorpayOrderId) {
    throw new Error("Razorpay payment does not match the checkout order.");
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const status = String(payment.status ?? "").toLowerCase();
    if (status === "captured" || status === "paid" || status === "authorized" || status === "failed") {
      break;
    }
    await sleep(500);
    payment = await fetchRazorpayPayment(paymentId, env);
    if (String(payment.order_id ?? "") !== razorpayOrderId) {
      throw new Error("Razorpay payment does not match the checkout order.");
    }
  }

  return payment;
}

export type VerifyRazorpayServerInput = {
  internalOrderId: string;
  storedRazorpayOrderId: string;
  clientRazorpayOrderId?: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  expectedAmountInr: number;
  expectedCurrency: string;
};

export async function verifyRazorpayPaymentOnServer(
  input: VerifyRazorpayServerInput,
  env: Record<string, string | undefined> = process.env
): Promise<PaymentEvent> {
  const { keySecret } = envCredentials(env);
  const razorpayOrderId = input.storedRazorpayOrderId.trim();
  const paymentId = input.razorpayPaymentId.trim();
  const signature = input.razorpaySignature.trim();

  if (!razorpayOrderId || !paymentId || !signature) {
    throw new Error("Razorpay payment verification payload is incomplete.");
  }

  if (input.clientRazorpayOrderId?.trim() && input.clientRazorpayOrderId.trim() !== razorpayOrderId) {
    logPaymentWarning("razorpay_order_id_client_mismatch", {
      orderId: input.internalOrderId,
      storedIntentId: razorpayOrderId,
      clientIntentId: input.clientRazorpayOrderId.trim()
    });
    throw new Error("Razorpay order does not match this checkout session.");
  }

  verifyRazorpaySignature(razorpayOrderId, paymentId, signature, keySecret);
  logPaymentEvent("razorpay_signature_verified", {
    orderId: input.internalOrderId,
    providerIntentId: razorpayOrderId,
    providerPaymentId: paymentId
  });

  const payment = await resolveGatewayPayment(paymentId, razorpayOrderId, env);
  const gatewayAmountInr = Number(payment.amount ?? 0) / 100;
  const gatewayCurrency = String(payment.currency ?? "INR").trim().toUpperCase();
  const expectedCurrency = input.expectedCurrency.trim().toUpperCase();

  if (gatewayCurrency !== expectedCurrency) {
    throw new Error("Payment currency mismatch.");
  }

  const expectedPaise = inrToPaise(input.expectedAmountInr);
  const gatewayPaise = inrToPaise(gatewayAmountInr);
  if (expectedPaise !== gatewayPaise && !inrAmountsMatch(input.expectedAmountInr, gatewayAmountInr)) {
    logPaymentWarning("razorpay_amount_mismatch", {
      orderId: input.internalOrderId,
      expected: input.expectedAmountInr,
      received: gatewayAmountInr
    });
    throw new Error("Payment amount mismatch.");
  }

  const status = mapGatewayPaymentStatus(payment.status);
  logPaymentEvent("razorpay_gateway_status_resolved", {
    orderId: input.internalOrderId,
    providerPaymentId: paymentId,
    gatewayStatus: payment.status ?? "unknown",
    mappedStatus: status
  });

  return {
    provider: "razorpay",
    intentId: razorpayOrderId,
    paymentId: String(payment.id ?? paymentId),
    status,
    amount: gatewayAmountInr,
    currency: gatewayCurrency,
    raw: payment as JsonRecord
  };
}
