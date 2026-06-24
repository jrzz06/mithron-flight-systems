import { describe, expect, it } from "vitest";
import { inkFromHexColor, inkFromLuminance, resolveInitialNavbarTone } from "@/lib/navbar-ink-sampling";

describe("navbar ink sampling", () => {
  it("uses light ink on dark hero regions", () => {
    expect(inkFromLuminance(0.18)).toBe("light");
    expect(inkFromHexColor("#182828")).toBe("light");
  });

  it("uses dark ink on bright hero regions", () => {
    expect(inkFromLuminance(0.82)).toBe("dark");
    expect(inkFromHexColor("#f8f8f8")).toBe("dark");
  });

  it("resolves SSR-safe initial navbar tone for hero-backed routes", () => {
    expect(resolveInitialNavbarTone("/")).toBe("light");
    expect(resolveInitialNavbarTone("/category/agri-drones")).toBe("light");
    expect(resolveInitialNavbarTone("/agriculture")).toBe("light");
    expect(resolveInitialNavbarTone("/products")).toBe("dark");
    expect(resolveInitialNavbarTone("/product/example")).toBe("dark");
  });
});
