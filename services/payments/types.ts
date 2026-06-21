export type PaymentProviderId = "razorpay" | "stripe" | "stub";

export type CreateIntentInput = {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  metadata?: Record<string, string>;
};

export type PaymentIntentResult = {
  intentId: string;
  clientSecret?: string;
  providerOrderId?: string;
  checkoutUrl?: string;
};

export type PaymentEvent = {
  provider: PaymentProviderId;
  intentId: string;
  paymentId?: string;
  status: "requires_payment" | "processing" | "succeeded" | "failed" | "refunded";
  amount: number;
  currency: string;
  raw: unknown;
};

export type RefundResult = {
  refundId: string;
  status: "pending" | "succeeded" | "failed";
};

export type PaymentGateway = {
  id: PaymentProviderId;
  createIntent(input: CreateIntentInput): Promise<PaymentIntentResult>;
  verifyWebhook(payload: unknown, signature: string, rawBody?: string): Promise<PaymentEvent>;
  refund(intentId: string, amount?: number): Promise<RefundResult>;
};
