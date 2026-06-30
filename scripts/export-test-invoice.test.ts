import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getStoredInvoiceHtml } from "@/lib/invoice/generate-invoice";

const orderId = process.env.TEST_INVOICE_ORDER_ID ?? "f1662fc3-8766-48a2-8c31-5b4fdb602944";
const outDir = resolve(process.cwd(), "test-output");
const outFile = resolve(outDir, `invoice-${orderId}.html`);

describe("export test invoice html", () => {
  it("writes stored invoice HTML to test-output/", async () => {
    const html = await getStoredInvoiceHtml(orderId);
    expect(html).toBeTruthy();
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, html!, "utf8");
    console.log("Wrote:", outFile);
  }, 30_000);
});
