import { describe, expect, it } from "vitest";
import { generateAndStoreInvoice, getStoredInvoiceRecord } from "@/lib/invoice/generate-invoice";

const orderId = process.env.TEST_INVOICE_ORDER_ID ?? "f1662fc3-8766-48a2-8c31-5b4fdb602944";

describe("generate test invoice", () => {
  it("generates and stores a GST invoice for a real order", async () => {
    const result = await generateAndStoreInvoice(orderId);
    expect(result.invoiceNumber).toMatch(/^INV-\d{5}\/\d{2}-\d{2}$/);
    expect(result.invoiceUrl).toContain(orderId);

    const stored = await getStoredInvoiceRecord(orderId);
    expect(stored?.invoice_number).toBe(result.invoiceNumber);
    expect(String(stored?.invoice_html ?? "")).toContain("mi-wrap");

    console.log("\n--- Test invoice generated ---");
    console.log("Order ID:", orderId);
    console.log("Invoice number:", result.invoiceNumber);
    console.log("Invoice URL (local):", `http://localhost:3000/api/invoices/${orderId}`);
    console.log("Account page:", `http://localhost:3000/account/orders/${orderId}/invoice`);
  }, 60_000);
});
