import { describe, expect, it } from "vitest";
import { assignEnquiry, submitCheckoutProductEnquiry, submitEnquiry } from "@/services/enquiries";
import { buildValidatedOrderDraft } from "@/services/orders";

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
  });
});
