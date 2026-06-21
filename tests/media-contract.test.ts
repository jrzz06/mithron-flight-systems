// static.wixstatic.com
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import { getGeneratedAssetCoverage } from "@/config/generated-assets";
import { getCriticalMediaManifest } from "@/config/media";
import { heroSlides, interests } from "@/config/products";
import { getProductBySlug, getProducts } from "@/services/catalog";

const supabaseStoragePrefix = "/storage/v1/object/public/mithron-products/";

async function collectStorefrontAssets() {
  const products = await getProducts();
  const assets = [
    ...heroSlides.flatMap((slide) => [slide.image, slide.poster]),
    ...interests.map((interest) => interest.image),
    ...products.flatMap((product) => [
      product.image,
      product.hero,
      ...product.gallery,
      ...product.story.map((chapter) => chapter.media)
    ])
  ];

  return assets.filter((asset, index, list) => list.findIndex((candidate) => candidate.src === asset.src) === index);
}

describe("cinematic media contract", () => {
  it("keeps local cached media limited to cinematic shell assets", () => {
    const [firstHero] = heroSlides;
    const manifest = getCriticalMediaManifest();

    expect(firstHero?.title).toBe("DRONE IS MITHRON");
    expect(firstHero?.poster.src).toMatch(/^\/assets\/hero\//);
    expect(firstHero?.video).toBeUndefined();
    expect(firstHero?.image.src).toMatch(/^\/assets\/hero\//);
    expect(manifest.map((asset) => asset.id)).toEqual(
      expect.arrayContaining(["hero-ag10-poster", "hero-ag10-loop"])
    );
    expect(manifest.some((asset) => asset.role === "product")).toBe(false);
    expect(manifest.some((asset) => asset.src.includes("/media/mithron/products/"))).toBe(false);
    expect(manifest.every((asset) => asset.src.startsWith("/media/mithron/"))).toBe(true);
  });

  it("describes source PDP media with real Mithron product imagery", async () => {
    const product = await getProductBySlug("source-agri-kisan-drone-small-8-liter");

    expect(product?.name).toBe("Agri Kisan Drone Small - 8 Liter");
    expect(product?.image.src).toContain("/storage/v1/object/public/mithron-products/");
    expect(product?.image.width).toBeGreaterThanOrEqual(720);
    expect(product?.image.height).toBeGreaterThanOrEqual(720);
    expect(product?.gallery.map((asset) => asset.src)).toContain(product?.image.src);
    expect(product?.specs["Product ID"]).toBe("mithron-agri-kisan-drone-small-8-liter");
  });

  it("does not expose constrained legacy thumbnail renditions as primary catalog product images", async () => {
    const products = await getProducts();
    const constrainedPrimaryImages = products.filter((product) => /\/v1\/fit\/w_(?:50|500),h_(?:50|500),q_\d+\/file\./i.test(product.image.src));
    const lowResolutionPrimaryImages = products.filter((product) => {
      const width = product.image.width ?? 0;
      const height = product.image.height ?? 0;
      return width > 0 && height > 0 && Math.max(width, height) < 720;
    });

    expect(constrainedPrimaryImages.map((product) => `${product.slug}:${product.image.src}`)).toEqual([]);
    expect(lowResolutionPrimaryImages.map((product) => `${product.slug}:${product.image.width}x${product.image.height}`)).toEqual([]);
  });

  it("keeps local generated responsive metadata for cinematic shell assets", () => {
    const assets = interests.map((interest) => interest.image);

    expect(assets.length).toBeGreaterThanOrEqual(9);
    expect(
      assets.every((asset) => {
        const responsive = (asset as typeof asset & { responsive?: unknown }).responsive;
        return Boolean(responsive);
      })
    ).toBe(true);
    expect(
      assets.every((asset) => {
        const responsive = (asset as typeof asset & { responsive?: { status?: string; bucket?: string; fallbackSrc?: string } }).responsive;
        return (
          responsive?.fallbackSrc === asset.src &&
          ["generated", "fallback", "missing"].includes(responsive.status ?? "") &&
          typeof responsive.bucket === "string" &&
          responsive.bucket.startsWith("mithron-")
        );
      })
    ).toBe(true);
  });

  it("renders database product images from Supabase storage", async () => {
    const assets = await collectStorefrontAssets();
    const productAssets = assets.filter((asset) => asset.src.includes(supabaseStoragePrefix));

    expect(productAssets.length).toBeGreaterThan(100);
    expect(productAssets.every((asset) => asset.src.includes(".supabase.co"))).toBe(true);
  });

  it("renders database product images directly when no generated variant exists", async () => {
    const product = await getProductBySlug("source-hobbywing-x8-3011-propellers-with-mount-ccw");
    expect(product).toBeDefined();
    expect(product!.image.src).toContain(supabaseStoragePrefix);

    render(createElement(MithronResponsiveImage, { src: product!.image.src, alt: product!.image.alt, sizes: "80px" }));

    const image = screen.getByRole("img", { name: product!.image.alt });
    const picture = image.closest("picture");
    const wixSource = picture?.querySelector('source[srcset*="wixstatic"]');

    expect(picture?.getAttribute("data-mithron-asset-status")).toBe("missing");
    expect(picture?.getAttribute("data-mithron-asset-bucket")).toBe("unmapped");
    expect(wixSource).toBeNull();
    expect(image.getAttribute("src")).toBe(product!.image.src);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("fetchpriority", "auto");
  });

  it("renders Supabase catalog cutouts without legacy CDN srcsets", () => {
    const catalogSrc = "https://ictnoydmxlywwxwnugal.supabase.co/storage/v1/object/public/mithron-products/catalog-cutouts/v1/15-inch-drone-frame-001b273acafa.webp";

    render(createElement(MithronResponsiveImage, {
      src: catalogSrc,
      alt: "15-inch Drone Frame",
      width: 1200,
      height: 900,
      sizes: "(min-width: 768px) 320px, 80vw"
    }));

    const image = screen.getByRole("img", { name: "15-inch Drone Frame" });
    const picture = image.closest("picture");
    expect(image.getAttribute("src")).toBe(catalogSrc);
    expect(picture?.querySelector('source[srcset*="wixstatic"]')).toBeNull();
  });

  it("serves shelf hero assets from Supabase enhanced webp variants", async () => {
    const { MithronShelfHeroImage } = await import("@/components/media/mithron-shelf-hero-image");
    render(createElement(MithronShelfHeroImage, {
      src: "/media/mithron/showcase/drone_world_hero.png",
      alt: "Mithron Drone World hardware",
      sizes: "(max-width: 640px) 100vw, 1280px"
    }));

    const image = screen.getByRole("img", { name: "Mithron Drone World hardware" });
    const picture = image.closest("picture");

    expect(picture?.getAttribute("data-mithron-asset-status")).toBe("generated");
    expect(image.getAttribute("src")).toContain("supabase.co/storage");
    expect(image.getAttribute("src")).toContain("drone_world_hero");
    expect(image.getAttribute("src")).toMatch(/\.webp$/);
    expect(picture?.querySelector('source[type="image/webp"]')?.getAttribute("srcset")).toContain("w");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("keeps asset coverage status honest after Supabase upload verification", () => {
    const coverage = getGeneratedAssetCoverage();

    expect(coverage.buckets).toEqual(["mithron-hero", "mithron-products", "mithron-interests", "mithron-story"]);
    expect(coverage.total).toBeGreaterThan(15);
    expect(coverage.generated).toBe(coverage.total);
    expect(coverage.fallback).toBe(0);
  });
});
