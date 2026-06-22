import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("catalog media precedence", () => {
  it("prefers canonical product_media_assets links over inline JSON images", () => {
    const catalog = source("services/catalog.ts");
    const linkedMediaIndex = catalog.indexOf("if (linkedMedia) return linkedMedia;");
    const rowImageIndex = catalog.indexOf("selectPrimaryProductImage(row, name)");
    expect(linkedMediaIndex).toBeGreaterThan(-1);
    expect(rowImageIndex).toBeGreaterThan(linkedMediaIndex);
    expect(catalog).toContain("inline JSON image fallback");
  });

  it("tracks published products missing primary media links", () => {
    const catalog = source("services/catalog.ts");
    const admin = source("services/admin.ts");
    expect(catalog).toContain("countPublishedProductsWithoutPrimaryLink");
    expect(admin).toContain("publishedProductsWithoutPrimaryLink");
    expect(admin).toContain("mediaParityVerified");
  });
});
