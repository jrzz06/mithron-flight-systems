import type { PaymentGateway } from "./types";
import { createRazorpayGateway } from "./razorpay";

export { RazorpayGateway, createRazorpayGateway } from "./razorpay";

class StubPaymentGateway implements PaymentGateway {
  id = "stub" as const;

  async createIntent(input: import("./types").CreateIntentInput) {
    return {
      intentId: `stub_intent_${input.orderId}`,
      checkoutUrl: `/checkout?order=${input.orderId}&stub=1`
    };
  }

  async verifyWebhook(payload: unknown) {
    const body = payload as Record<string, unknown>;
    return {
      provider: "stub" as const,
      intentId: String(body.intentId ?? ""),
      paymentId: String(body.paymentId ?? `stub_pay_${Date.now()}`),
      status: "succeeded" as const,
      amount: Number(body.amount ?? 0),
      currency: String(body.currency ?? "INR"),
      raw: payload
    };
  }

  async refund(intentId: string) {
    return { refundId: `stub_refund_${intentId}`, status: "succeeded" as const };
  }
}

class UnconfiguredGateway implements PaymentGateway {
  constructor(public id: import("./types").PaymentProviderId) {}

  async createIntent(): Promise<never> {
    throw new Error(`${this.id} payment gateway is not configured. Set provider credentials in environment variables.`);
  }

  async verifyWebhook(): Promise<never> {
    throw new Error(`${this.id} payment gateway is not configured.`);
  }

  async refund(): Promise<never> {
    throw new Error(`${this.id} payment gateway is not configured.`);
  }
}

export function isPaymentGatewayConfigured(env: Record<string, string | undefined> = process.env) {
  const provider = (env.PAYMENT_PROVIDER ?? "stub").toLowerCase();
  if (provider === "stub") {
    return env.NODE_ENV !== "production";
  }
  if (provider === "stripe") {
    return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  }
  if (provider === "razorpay") {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
  }
  return false;
}

export function getPaymentGateway(env: Record<string, string | undefined> = process.env): PaymentGateway {
  const provider = (env.PAYMENT_PROVIDER ?? "stub").toLowerCase() as import("./types").PaymentProviderId;
  if (provider === "stub") {
    if (env.NODE_ENV === "production") {
      return new UnconfiguredGateway("stub");
    }
    return new StubPaymentGateway();
  }
  if (provider === "razorpay") {
    if (!isPaymentGatewayConfigured(env)) {
      return new UnconfiguredGateway("razorpay");
    }
    return createRazorpayGateway(env);
  }
  return new UnconfiguredGateway(provider);
}

export async function createPaymentIntent(input: import("./types").CreateIntentInput) {
  return getPaymentGateway().createIntent(input);
}

export async function verifyPaymentWebhook(payload: unknown, signature: string, rawBody?: string) {
  return getPaymentGateway().verifyWebhook(payload, signature, rawBody);
}
