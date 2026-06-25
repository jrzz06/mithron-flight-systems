import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin enquiry lifecycle workflow", () => {
  it("fixes mark contacted assignee handling and exposes full lifecycle actions", () => {
    const actions = readFileSync(join(process.cwd(), "app/admin/enquiries/actions.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "app/admin/enquiries/page.tsx"), "utf8");
    const queue = readFileSync(join(process.cwd(), "components/admin/admin-enquiry-queue.tsx"), "utf8");
    const service = readFileSync(join(process.cwd(), "services/enquiries.ts"), "utf8");

    expect(actions).toContain("markEnquiryContactedFormAction");
    expect(actions).toContain("addEnquiryNoteFormAction");
    expect(actions).toContain("qualifyEnquiryFormAction");
    expect(actions).toContain("updateEnquiryMetaFormAction");
    expect(actions).not.toContain('assigned_to") ?? context.userId');
    expect(queue).toContain("data-enquiry-queue");
    expect(queue).toContain("Next action");
    expect(queue).toContain("Convert to order");
    expect(page).toContain("AdminEnquiryQueue");
    expect(page).toContain("EnquiryQueueLiveSync");
    expect(actions).toContain("markCheckoutOrderEnquiryContacted");
    expect(service).toContain("notifyAdminsAboutEnquiry");
    expect(service).toContain("createActivityLogRecord");
    expect(service).toContain("markEnquiryContacted");
    expect(service).toContain("addEnquiryNote");
    expect(service).toContain("qualifyEnquiry");
  });

  it("notifies admins when enquiries are submitted", () => {
    const service = readFileSync(join(process.cwd(), "services/enquiries.ts"), "utf8");
    const contactRoute = readFileSync(join(process.cwd(), "app/api/enquiries/route.ts"), "utf8");
    const checkoutRoute = readFileSync(join(process.cwd(), "app/api/checkout/enquiry/route.ts"), "utf8");

    expect(service).toContain("notifyAdminsAboutEnquiry");
    expect(contactRoute).not.toContain("notifyAdminsAboutEnquiry");
    expect(checkoutRoute).toContain("await submitCheckoutProductEnquiry(");
    expect(checkoutRoute).not.toMatch(/submitCheckoutProductEnquiry\([\s\S]*\)\.catch\(/);
  });
});
