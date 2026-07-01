import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("product shelf mobile scroll", () => {
  it("enables horizontal touch scrolling on mobile shelf grids without blocking vertical page scroll", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    expect(css).toContain("touch-action: pan-x pan-y");
    expect(css).not.toMatch(/\.productCard[\s\S]*touch-action:\s*pan-x;/);
    expect(css).toMatch(/productShelfSection\[data-shelf-tone="global"\] \.productShelfGrid[\s\S]*overflow-x: auto/);
  });

  it("uses a client scroll rail for shelf cards", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const rail = source("sections/home/product-shelf-scroll-rail.tsx");
    expect(component).toContain("ProductShelfScrollRail");
    expect(rail).toContain("onTouchMove");
    expect(rail).toContain("onClickCapture");
  });
});
