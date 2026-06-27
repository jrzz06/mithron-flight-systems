import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("contact requests workflow", () => {
  it("defines contact_requests table and link RPC in migration", () => {
    const migration = source("supabase/migrations/20260702000100_enterprise_order_lifecycle.sql");
    expect(migration).toContain("contact_requests");
    expect(migration).toContain("link_contact_request_to_order");
  });

  it("exposes contact request service operations", () => {
    const service = source("services/contact-requests.ts");
    expect(service).toContain("submitContactRequest");
    expect(service).toContain("listAdminContactRequests");
    expect(service).toContain("markContactRequestContacted");
    expect(service).toContain("archiveContactRequest");
    expect(service).toContain("rejectContactRequest");
    expect(service).toContain("restoreContactRequest");
    expect(service).toContain("rpc/link_contact_request_to_order");
  });

  it("routes contact form and legacy enquiries API to contact requests", () => {
    const contactRoute = source("app/api/contact-requests/route.ts");
    const enquiriesRoute = source("app/api/enquiries/route.ts");
    const form = source("components/contact/enquiry-form.tsx");
    expect(contactRoute).toContain("submitContactRequest");
    expect(enquiriesRoute).toContain("submitContactRequest");
    expect(form).toContain("/api/contact-requests");
  });

  it("includes admin contact request module", () => {
    const nav = source("components/platform/nav-config.ts");
    expect(nav).toContain("/admin/contact-requests");
    expect(source("app/admin/contact-requests/page.tsx")).toContain("AdminContactRequestQueue");
  });
});
