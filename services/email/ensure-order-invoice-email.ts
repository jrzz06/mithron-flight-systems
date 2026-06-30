import "server-only";

export type { PaidOrderFulfillment as EnsureOrderInvoiceEmailResult } from "@/services/invoice/payment-fulfillment";
export { fulfillOrderOnPaymentVerified as ensureOrderInvoiceAndEmail } from "@/services/invoice/payment-fulfillment";
