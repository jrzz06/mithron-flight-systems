import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assignEnquiry,
  convertEnquiryToOrderAtomic,
  markEnquiryContacted,
  submitCheckoutProductEnquiry,
  submitEnquiry
} from "@/services/enquiries";
import { buildValidatedOrderDraft } from "@/services/orders";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("enquiry workflow", () => {
  it("validates enquiry conversion order draft shape", () => {
    const draft = buildValidatedOrderDraft(
      {
        customerEmail: "buyer@example.com",
        items: [{ productSlug: "ag10", quantity: 1 }],
        metadata: { source_enquiry_id: "enq-1" }
      },
      [{ slug: "ag10", name: "Ag10", price: 1000, category: "agriculture" }]
    );
    expect(draft.order.customer_email).toBe("buyer@example.com");
    expect(draft.orderItems).toHaveLength(1);
  });

  it("exports enquiry service operations", () => {
    expect(typeof submitEnquiry).toBe("function");
    expect(typeof submitCheckoutProductEnquiry).toBe("function");
    expect(typeof assignEnquiry).toBe("function");
    expect(typeof markEnquiryContacted).toBe("function");
    expect(typeof convertEnquiryToOrderAtomic).toBe("function");
  });

  it("routes enquiry conversion through atomic RPC with idempotency", () => {
    const migration = source("supabase/migrations/20260702000100_enterprise_order_lifecycle.sql");
    const enquiries = source("services/enquiries.ts");
    expect(migration).toContain("convert_enquiry_to_order_atomic");
    expect(migration).toContain("converted_order_id");
    expect(enquiries).toContain("rpc/convert_enquiry_to_order_atomic");
    expect(enquiries).toContain("convertEnquiryToOrderAtomic");
    expect(enquiries).toContain("return convertEnquiryToOrderAtomic");
  });

  it("lists product enquiries only without checkout_order synthetic queue", () => {
    const enquiries = source("services/enquiries.ts");
    expect(enquiries).toContain("enquiry_kind=in.(product,checkout)");
    expect(enquiries).not.toContain('queue_kind: "checkout_order"');
    expect(enquiries).toContain('queue_kind: "enquiry"');
  });
});
