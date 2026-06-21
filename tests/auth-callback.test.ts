import { describe, expect, it } from "vitest";
import { getSafeAuthRedirectPath } from "@/lib/auth/redirects";

describe("auth callback redirect safety", () => {
  it("allows only local redirect paths after Supabase auth exchange", () => {
    expect(getSafeAuthRedirectPath("/admin/cms")).toBe("/admin/cms");
    expect(getSafeAuthRedirectPath("/warehouse/inventory?status=low")).toBe("/warehouse/inventory?status=low");
    expect(getSafeAuthRedirectPath("https://evil.example/admin")).toBe("/admin");
    expect(getSafeAuthRedirectPath("//evil.example/admin")).toBe("/admin");
    expect(getSafeAuthRedirectPath("")).toBe("/admin");
  });
});
