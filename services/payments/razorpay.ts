import { createHmac, timingSafeEqual } from "node:crypto";
import type {
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
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (!keyId || !keySecret || !webhookSecret) {
    throw new Error("Razorpay credentials are not fully configured.");
  }
  return { keyId, keySecret, webhookSecret };
}

function mapRazorpayStatus(event: string, paymentStatus?: string): PaymentEvent["status"] {
  if (event === "payment.failed" || paymentStatus === "failed") return "failed";
  if (event === "payment.captured" || paymentStatus === "captured") return "succeeded";
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
    const amountPaise = Math.round(input.amount * 100);
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
        receipt: input.orderId,
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
      checkoutUrl: undefined
    };
  }

  async verifyWebhook(payload: unknown, signature: string, rawBody?: string): Promise<PaymentEvent> {
    const { webhookSecret } = envCredentials(this.env);
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
