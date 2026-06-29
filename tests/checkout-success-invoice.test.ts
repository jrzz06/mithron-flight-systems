import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("post-payment invoice and email fulfillment", () => {
  it("ensures invoice generation and confirmation email after payment", () => {
    const ensure = source("services/email/ensure-order-invoice-email.ts");
    expect(ensure).toContain("generateAndStoreInvoice");
    expect(ensure).toContain("sendOrderConfirmationEmail");
    expect(ensure).toContain("confirmation_email_sent_at");
  });

  it("exposes checkout success API for invoice display", () => {
    const route = source("app/api/checkout/success/route.ts");
    expect(route).toContain("ensureOrderInvoiceAndEmail");
    expect(route).toContain("invoiceUrl");
  });

  it("returns invoice details from payment verify API", () => {
    const route = source("app/api/payments/verify/route.ts");
    expect(route).toContain("ensureOrderInvoiceAndEmail");
    expect(route).toContain("invoiceNumber");
    expect(route).toContain("emailSent");
  });

  it("renders invoice on checkout success page", () => {
    const page = source("app/(storefront)/checkout/success/checkout-success-client.tsx");
    expect(page).toContain("/api/checkout/success");
    expect(page).toContain("invoiceFrame");
    expect(page).toContain("emailSent");
  });
});
