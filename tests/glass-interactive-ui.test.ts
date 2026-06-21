import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("glass interactive ui system", () => {
  it("defines centralized glass tokens and reusable classes", () => {
    const glass = source("app/glass-interactive.css");

    expect(glass).toContain("--glass-green-ink: #111111");
    expect(glass).toContain("--glass-green-ink-hover: #111111");
    expect(glass).toContain("--brand-cta-ink: var(--glass-green-ink)");
    expect(glass).toContain(".glass-button");
    expect(glass).toContain(".glass-button--cart");
    expect(glass).toContain(".glass-pill");
    expect(glass).toContain(".glass-badge");
    expect(glass).toContain(".glass-chip");
  });

  it("wires accent buttons through the shared glass button system", () => {
    const button = source("components/ui/button.tsx");
    const configurator = source("sections/product/product-configurator.tsx");

    expect(button).toContain('accentCart: cn(glassButtonClassName({ cart: true })');
    expect(configurator).toContain('variant="accentCart"');
    expect(configurator).toContain("glassPillClassName");
  });

  it("does not modify the Mithron logo markup or styling", () => {
    const nav = source("components/navigation/store-nav.tsx");

    expect(nav).toContain('resolveStorefrontSrc("/media/mithron/shell/mithron-wordmark.png")');
    expect(nav).not.toContain("glass-button");
    expect(nav).toContain("mithron-brand-mark");
  });
});
