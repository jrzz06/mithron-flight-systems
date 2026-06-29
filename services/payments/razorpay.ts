import { createHmac, timingSafeEqual } from "node:crypto";
import { assertMinimumCheckoutAmount, inrToPaise } from "./amount";
import type {
  ClientPaymentVerificationInput,
  CreateIntentInput,
  PaymentEvent,
  PaymentGateway,
  PaymentIntentResult,
  RefundResult
} from "./types";

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
};

function envCredentials(env: Record<string, string | undefined>) {
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials are not configured.");
  }
  return { keyId, keySecret };
}

function envWebhookSecret(env: Record<string, string | undefined>) {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookSecret) {
    throw new Error("Razorpay webhook secret is not configured.");
  }
  return webhookSecret;
}

function mapRazorpayStatus(event: string, paymentStatus?: string): PaymentEvent["status"] {
  if (event === "payment.failed" || paymentStatus === "failed") return "failed";
  if (event === "payment.refunded" || event === "refund.processed" || paymentStatus === "refunded") return "refunded";
  if (event === "payment.captured" || paymentStatus === "captured" || paymentStatus === "paid") return "succeeded";
  if (event === "payment.authorized" || paymentStatus === "authorized") return "processing";
  return "requires_payment";
}

export class RazorpayGateway implements PaymentGateway {
  id = "razorpay" as const;
  private env: Record<string, string | undefined>;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env;
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentResult> {
    const { keyId, keySecret } = envCredentials(this.env);
    const normalizedAmount = assertMinimumCheckoutAmount(input.amount, "Razorpay");
    const amountPaise = inrToPaise(normalizedAmount);
    const receipt = (input.metadata?.receipt ?? input.orderId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: input.currency || "INR",
        receipt: receipt || input.orderId.slice(0, 40),
        payment_capture: 1,
        notes: {
          order_id: input.orderId,
          customer_email: input.customerEmail,
          ...input.metadata
        }
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Razorpay order creation failed (${response.status})${body ? `: ${body.slice(0, 240)}` : ""}`);
    }

    const order = (await response.json()) as RazorpayOrderResponse;
    return {
      intentId: order.id,
      providerOrderId: order.id,
      clientSecret: order.id,
      checkoutUrl: undefined,
      amountPaise: order.amount
    };
  }

  async verifyClientPayment(input: ClientPaymentVerificationInput): Promise<PaymentEvent> {
    const { keySecret } = envCredentials(this.env);
    const orderId = input.intentId.trim();
    const paymentId = input.paymentId?.trim() ?? "";
    const signature = input.signature?.trim() ?? "";
    if (!orderId || !paymentId || !signature) {
      throw new Error("Razorpay payment verification payload is incomplete.");
    }

    const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new Error("Invalid Razorpay payment signature.");
    }

    const { keyId } = envCredentials(this.env);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Razorpay payment lookup failed (${response.status}).`);
    }

    const payment = (await response.json()) as {
      id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string;
    };

    if (String(payment.order_id ?? "") !== orderId) {
      throw new Error("Razorpay payment does not match the checkout order.");
    }

    return {
      provider: "razorpay",
      intentId: orderId,
      paymentId: String(payment.id ?? paymentId),
      status: mapRazorpayStatus("", payment.status),
      amount: Number(payment.amount ?? 0) / 100,
      currency: String(payment.currency ?? "INR"),
      raw: payment
    };
  }

  async fetchPaymentStatus(intentId: string): Promise<PaymentEvent> {
    const { keyId, keySecret } = envCredentials(this.env);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(intentId)}/payments`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Razorpay order lookup failed (${response.status}).`);
    }

    const body = (await response.json()) as { items?: Array<{ id?: string; amount?: number; currency?: string; status?: string }> };
    const payment = body.items?.[0];
    if (!payment) {
      return {
        provider: "razorpay",
        intentId,
        status: "requires_payment",
        amount: 0,
        currency: "INR",
        raw: body
      };
    }

    return {
      provider: "razorpay",
      intentId,
      paymentId: payment.id ? String(payment.id) : undefined,
      status: mapRazorpayStatus("", payment.status),
      amount: Number(payment.amount ?? 0) / 100,
      currency: String(payment.currency ?? "INR"),
      raw: payment
    };
  }

  async verifyWebhook(payload: unknown, signature: string, rawBody?: string): Promise<PaymentEvent> {
    const webhookSecret = envWebhookSecret(this.env);
    const body = rawBody ?? JSON.stringify(payload);
    const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
    const provided = signature.replace(/^sha256=/, "").trim();

    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new Error("Invalid Razorpay webhook signature.");
    }

    const bodyJson = (typeof payload === "object" && payload !== null ? payload : JSON.parse(body)) as RazorpayWebhookPayload;
    const eventName = String(bodyJson.event ?? "");
    const payment = bodyJson.payload?.payment?.entity;
    const intentId = String(payment?.order_id ?? "");
    const paymentId = payment?.id ? String(payment.id) : undefined;
    const amount = Number(payment?.amount ?? 0) / 100;
    const currency = String(payment?.currency ?? "INR");

    return {
      provider: "razorpay",
      intentId,
      paymentId,
      status: mapRazorpayStatus(eventName, payment?.status),
      amount,
      currency,
      raw: bodyJson
    };
  }

  async refund(intentId: string, amount?: number): Promise<RefundResult> {
    const { keyId, keySecret } = envCredentials(this.env);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(intentId)}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(amount ? { amount: Math.round(amount * 100) } : {})
    });

    if (!response.ok) {
      throw new Error(`Razorpay refund failed (${response.status}).`);
    }

    const refund = (await response.json()) as { id?: string; status?: string };
    return {
      refundId: String(refund.id ?? `refund_${intentId}`),
      status: refund.status === "processed" ? "succeeded" : "pending"
    };
  }
}

export function createRazorpayGateway(env: Record<string, string | undefined> = process.env) {
  return new RazorpayGateway(env);
}
