import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("hydration stability", () => {
  it("avoids route-transition server/client branches during initial render", () => {
    const routeTransition = source("components/layout/route-transition.tsx");
    const globals = source("app/globals.css");

    expect(routeTransition).not.toContain("typeof window");
    expect(routeTransition).not.toContain("framer-motion");
    expect(routeTransition).not.toContain("motion.div");
    expect(routeTransition).toContain("useState(() => hasHydratedRouteTransition)");
    expect(globals).toContain("@keyframes mithronRouteEntry");
  });

  it("defers persisted cart badge until after client hydration", () => {
    const cartNavButton = source("components/navigation/cart-nav-button.tsx");

    expect(cartNavButton).toContain("useSyncExternalStore");
    expect(cartNavButton).toContain("const displayCount = hydrated ? count : 0");
    expect(cartNavButton).not.toContain("typeof window");
  });

  it("keeps public CMS storefront reads bounded", () => {
    const cms = source("services/cms.ts");
    const publicSnapshotLoader = cms.match(/async function loadPublicCmsSnapshot[\s\S]*?export const getPublicCmsSnapshot/)?.[0] ?? "";

    expect(publicSnapshotLoader).not.toContain("select=*");
    expect(cms).not.toContain('query = "select=*');
    expect(cms).toContain("publicCmsQueries");
    expect(cms).toContain("select=id,product_slug,title,subtitle,cta_label,href,image,poster,video,theme,composition,title_color,subtitle_color,sort_order,is_visible,status");
    expect(cms).toContain("select=id,reviewer_name,body,product_slug,rating,sort_order,is_visible,status");
  });
});
