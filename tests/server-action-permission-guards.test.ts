import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("server action permission guards", () => {
  it("requires orders.lifecycle for warehouse actions", () => {
    const warehouse = source("app/warehouse/actions.ts");
    expect(warehouse).toContain('requirePermission("orders.lifecycle")');
  });

  it("requires cms.write for CMS form mutations", () => {
    const cms = source("app/admin/cms/actions.ts");
    expect(cms).toContain('requirePermission("cms.write")');
  });

  it("requires operations.write for operations actions", () => {
    const operations = source("app/operations/actions.ts");
    expect(operations).toContain('requirePermission("operations.write")');
  });

  it("requires products.write for product admin actions", () => {
    const products = source("app/admin/products/actions.ts");
    expect(products).toContain('requirePermission("products.write")');
  });

  it("requires media.write for media admin actions", () => {
    const media = source("app/admin/media/actions.ts");
    expect(media).toContain('requirePermission("media.write")');
  });
});
