import fs from "node:fs";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = "test-results/mithron-category-routes";
const captureScreenshots = process.env.SMOKE_SCREENSHOTS !== "0";

const canonicalRoutes = ["/", "/agriculture", "/video-drones", "/creative-drones", "/accessories", "/industrial", "/mapping", "/surveillance"];
const retiredCloneRoutes = ["/consumer", "/accessory", "/enterprise"];

fs.mkdirSync(outDir, { recursive: true });

const statuses = [];

for (const path of canonicalRoutes) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  statuses.push({ path, status: response.status, location: response.headers.get("location") ?? "" });
  if (response.status !== 200) {
    throw new Error(`Expected ${path} to return 200, received ${response.status}`);
  }
}

for (const path of retiredCloneRoutes) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  statuses.push({ path, status: response.status, location });
  if (response.status !== 404) {
    throw new Error(`Expected retired clone route ${path} to return 404, received ${response.status} ${location}`);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12_000);
const consoleMessages = [];
page.on("console", (message) => {
  if (["warning", "error"].includes(message.type())) {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  }
});

const routeEvidence = [];
const layoutFailures = [];
for (const path of canonicalRoutes) {
  const name = path === "/" ? "home" : path.slice(1);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("body").waitFor({ state: "visible" });
  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const retiredCloneHrefCount = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).filter((link) => {
      const href = link.getAttribute("href") ?? "";
      return href === "/consumer" || href === "/accessory" || href === "/enterprise";
    }).length
  );
  const firstCatalogCard = page.locator("[data-testid^='premium-product-card-']").first();
  if (path !== "/" && await firstCatalogCard.count()) {
    await firstCatalogCard.scrollIntoViewIfNeeded();
  }
  const catalogLayout = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("[data-testid^='premium-product-card-']")).slice(0, 8);
    const samples = cards.map((card) => {
      const cardRect = card.getBoundingClientRect();
      const title = card.querySelector(".premium-product-card__title");
      const description = card.querySelector(".premium-product-card__description");
      const footer = card.querySelector(".premium-product-card__footer");
      const price = card.querySelector(".premium-product-card__price");
      const cta = card.querySelector(".premium-product-card__cta");
      const titleRect = title?.getBoundingClientRect();
      const descriptionRect = description?.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      const priceRect = price?.getBoundingClientRect();
      const ctaRect = cta?.getBoundingClientRect();

      return {
        cardHeight: Math.round(cardRect.height),
        cardTop: Math.round(cardRect.top),
        footerTop: Math.round(footerRect?.top ?? 0),
        priceCenterY: Math.round((priceRect?.top ?? 0) + (priceRect?.height ?? 0) / 2),
        ctaCenterY: Math.round((ctaRect?.top ?? 0) + (ctaRect?.height ?? 0) / 2),
        titleHeight: Math.round(titleRect?.height ?? 0),
        descriptionHeight: Math.round(descriptionRect?.height ?? 0),
        ctaText: cta?.textContent?.trim() ?? ""
      };
    });

    const rows = new Map();
    for (const sample of samples) {
      const key = String(sample.cardTop);
      const row = rows.get(key) ?? [];
      row.push(sample);
      rows.set(key, row);
    }

    return {
      cardCount: samples.length,
      maxCardHeight: Math.max(0, ...samples.map((sample) => sample.cardHeight)),
      maxRowHeightDelta: Math.max(0, ...Array.from(rows.values()).map((row) => {
        const heights = row.map((sample) => sample.cardHeight);
        return Math.max(...heights) - Math.min(...heights);
      })),
      maxFooterTopDelta: Math.max(0, ...Array.from(rows.values()).map((row) => {
        const tops = row.map((sample) => sample.footerTop);
        return Math.max(...tops) - Math.min(...tops);
      })),
      maxBaselineDelta: Math.max(0, ...samples.map((sample) => Math.abs(sample.priceCenterY - sample.ctaCenterY))),
      titleHeights: samples.map((sample) => sample.titleHeight),
      descriptionHeights: samples.map((sample) => sample.descriptionHeight),
      ctaTexts: samples.map((sample) => sample.ctaText)
    };
  });

  if (captureScreenshots) {
    await page.screenshot({ path: `${outDir}/${name}-desktop.png`, fullPage: false });
  }
  routeEvidence.push({ path, h1, overflow, retiredCloneHrefCount, catalogLayout });
  if (!h1.trim()) layoutFailures.push(`Missing h1 on ${path}`);
  if (overflow > 1) layoutFailures.push(`Horizontal overflow on ${path}: ${overflow}`);
  if (retiredCloneHrefCount > 0) layoutFailures.push(`Found ${retiredCloneHrefCount} retired clone hrefs on ${path}`);
  if (path !== "/" && catalogLayout.cardCount > 0) {
    if (catalogLayout.maxCardHeight > 540) layoutFailures.push(`Catalog cards too tall on ${path}: ${catalogLayout.maxCardHeight}px`);
    if (catalogLayout.maxCardHeight < 420) layoutFailures.push(`Catalog cards did not render measurable height on ${path}: ${catalogLayout.maxCardHeight}px`);
    if (catalogLayout.maxRowHeightDelta > 1) layoutFailures.push(`Catalog row card heights misaligned on ${path}: ${catalogLayout.maxRowHeightDelta}px`);
    if (catalogLayout.maxFooterTopDelta > 1) layoutFailures.push(`Catalog footer baselines misaligned on ${path}: ${catalogLayout.maxFooterTopDelta}px`);
    if (catalogLayout.maxBaselineDelta > 3) layoutFailures.push(`Catalog price/CTA centers misaligned on ${path}: ${catalogLayout.maxBaselineDelta}px`);
    if (catalogLayout.ctaTexts.some((text) => !/view system/i.test(text))) layoutFailures.push(`Catalog CTA text is not explicit on ${path}`);
  }
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
await page.locator("body").waitFor({ state: "visible" });
await page.getByRole("button", { name: "Open menu" }).click();
if (captureScreenshots) {
  await page.screenshot({ path: `${outDir}/mobile-menu.png`, fullPage: false });
}
const mobileRetiredCloneHrefCount = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a[href]")).filter((link) => {
    const href = link.getAttribute("href") ?? "";
    return href === "/consumer" || href === "/accessory" || href === "/enterprise";
  }).length
);

await browser.close();

if (mobileRetiredCloneHrefCount > 0) {
  throw new Error(`Found ${mobileRetiredCloneHrefCount} retired clone hrefs in mobile menu`);
}

if (consoleMessages.length > 0) {
  throw new Error(`Console warnings/errors detected:\n${consoleMessages.join("\n")}`);
}

if (layoutFailures.length > 0) {
  throw new Error(`Catalog route smoke failures:\n${layoutFailures.join("\n")}`);
}

console.log(
  JSON.stringify(
    {
      statuses,
      routeEvidence,
      mobileRetiredCloneHrefCount,
      consoleMessages
    },
    null,
    2
  )
);
