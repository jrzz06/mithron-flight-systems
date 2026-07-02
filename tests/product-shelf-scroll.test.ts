import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("product shelf mobile scroll", () => {
  it("enables horizontal touch scrolling on tablet shelf grids without blocking vertical page scroll", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    const tabletShelfBlock = css.match(/@media \(max-width: 980px\)[\s\S]*?\.productShelfGrid \{[\s\S]*?\}/);

    expect(tabletShelfBlock?.[0]).toContain("touch-action: pan-x pan-y");
    expect(css).not.toMatch(/\.productCard[\s\S]*touch-action:\s*pan-x;/);
    expect(css).toMatch(/productShelfSection\[data-shelf-tone="global"\] \.productShelfGrid[\s\S]*overflow-x: auto/);
  });

  it("uses a horizontal snap carousel on phone shelves", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    const globalsCss = source("app/globals.css");
    const phoneShelfBlock = css.match(/@media \(max-width: 767px\)[\s\S]*?\.productShelfGrid \{[\s\S]*?\}/);

    expect(phoneShelfBlock?.[0]).toContain("grid-auto-flow: column");
    expect(phoneShelfBlock?.[0]).toContain("overflow-x: auto");
    expect(phoneShelfBlock?.[0]).toContain("scroll-snap-type: x mandatory");
    expect(phoneShelfBlock?.[0]).toContain("var(--shelf-card-width)");
    expect(phoneShelfBlock?.[0]).not.toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(globalsCss).toMatch(/--shelf-cards-per-viewport:\s*2\.1/);
    expect(globalsCss).toMatch(/--shelf-card-width:/);
  });

  it("uses a client scroll rail for shelf cards", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const rail = source("sections/home/product-shelf-scroll-rail.tsx");
    expect(component).toContain("ProductShelfScrollRail");
    expect(rail).toContain("onTouchMove");
    expect(rail).toContain("onClickCapture");
  });
});
