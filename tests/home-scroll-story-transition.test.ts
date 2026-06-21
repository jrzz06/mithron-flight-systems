import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const oldDraftCityOperatorId = ["draft", "city", "operators"].join("-");

describe("home composite scroll transition system", () => {
  it("uses one synchronized GSAP ScrollTrigger timeline for the composite section", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const css = source("sections/home/home-landing-composite.module.css");
    const globals = source("app/globals.css");

    expect(component).toContain("export function HomeLandingComposite");
    expect(component).toContain('data-testid="home-landing-composite"');
    expect(component).toContain('data-home-composite-root="true"');
    expect(component).toContain('data-motion-engine="native-gsap-scrolltrigger"');
    expect(component).toContain("ScrollTrigger.create");
    expect(component).toContain("scrub: true");
    expect(component).toContain("onUpdate: (self)");
    expect(component).toContain("--home-composite-progress");
    expect(component).toContain("ScrollTrigger.refresh()");
    expect(component).not.toContain("mithron:ensure-lenis");
    expect(component).not.toContain("mithron:lenis-ready");
    expect(component).not.toContain('window.addEventListener("scroll"');
    expect(component).not.toContain("SplitText");
    expect(component).toContain('data-testid="home-landing-composite"');
    expect(component).not.toContain('id: "about-us"');
    expect(component).not.toContain('id: "draft-testimonials"');
    expect(component).not.toContain('data-testimonial-state="fallback"');
    expect(component).not.toContain(oldDraftCityOperatorId);

    expect(css).toContain(".progressTrack");
    expect(css).toContain(".progressFill");
    expect(css).toContain("transform: scaleX(var(--home-composite-progress))");
    expect(css).toContain("position: sticky");
    expect(css).not.toMatch(/pin:\s*true|position:\s*fixed/);
    expect(globals).not.toContain("@import \"./storefront-showcase.css\"");
  });

  it("uses shelf rows followed by Agri and City mission worlds", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const chapterBlock = component.slice(
      component.indexOf("const chapters: HomeChapter[]"),
      component.indexOf("const productShelfConfigs")
    );

    for (const chapterId of [
      "drone-world",
      "drone-care",
      "global-products",
      "agri-drones",
      "city-drones"
    ]) {
      expect(chapterBlock).toContain(`id: "${chapterId}"`);
    }

    for (const removedId of ["lineup-solutions", "draft-testimonials", "creative-three", "about-us"]) {
      expect(chapterBlock).not.toContain(`id: "${removedId}"`);
    }

    expect(component).toContain("function ProductShelfSection");
    expect(component).toContain("function AgriCommunityWorldSection");
    expect(component).toContain("product.image.src");
    expect(component).toContain('href={`/product/${product.slug}`}');
    expect(component).toContain("Product feed unavailable. The shelf remains visible without fake catalog content.");
    expect(component).toContain('data-testid="home-product-shelf-section"');
    expect(component).toContain('data-testid="home-product-card"');
    expect(component).toContain('data-testid="agri-community-world-section"');
    expect(component).toContain('data-testid="mission-world-tile"');
    expect(component).toContain("AGRONE Pilot Registration");
    expect(component).toContain("Smart City Monitoring");
    expect(component).toContain("Traffic Analytics");
    expect(component).toContain('composition: "agri-field"');
    expect(component).toContain('composition: "city-urban"');
    expect(component).toContain("function HomeCustomerTestimonialsSection");
    expect(component).toContain("function HomeAboutUsBand");
    expect(component).not.toContain("function ThreeStorySection");
    expect(component).not.toContain("function AboutSection");
  });
});
