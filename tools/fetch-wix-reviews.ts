import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadWixClientFromEnv } from "@/lib/wix/catalog-client";

type WixReviewRecord = {
  id: string;
  entityId: string;
};

async function fetchAllReviews(apiKey: string, siteId: string) {
  const reviews: WixReviewRecord[] = [];
  let cursor: string | undefined;

  do {
    const body = {
      query: {
        paging: {
          limit: 100,
          ...(cursor ? { cursor } : {})
        }
      }
    };

    const response = await fetch("https://www.wixapis.com/reviews/api/v1/reviews/query", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "wix-site-id": siteId
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Wix reviews query failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
    }

    const payload = (await response.json()) as {
      results?: WixReviewRecord[];
      metadata?: { cursors?: { next?: string } };
    };

    reviews.push(...(payload.results ?? []));
    cursor = payload.metadata?.cursors?.next;
  } while (cursor);

  return reviews;
}

async function fetchProductIdMap(apiKey: string, siteId: string) {
  const products: Record<string, { slug: string; name: string }> = {};
  let offset = 0;

  while (true) {
    const response = await fetch("https://www.wixapis.com/stores-reader/v1/products/query", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "wix-site-id": siteId
      },
      body: JSON.stringify({
        query: {
          paging: { limit: 100, offset }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Wix products query failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
    }

    const payload = (await response.json()) as {
      products?: Array<{ id: string; slug: string; name: string }>;
    };

    const batch = payload.products ?? [];
    for (const product of batch) {
      products[product.id] = { slug: product.slug, name: product.name };
    }

    if (batch.length < 100) break;
    offset += 100;
  }

  return products;
}

async function main() {
  const { apiKey, siteId } = loadWixClientFromEnv();
  const extractedAt = new Date().toISOString();
  const [reviews, products] = await Promise.all([
    fetchAllReviews(apiKey, siteId),
    fetchProductIdMap(apiKey, siteId)
  ]);

  const dataDir = join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(dataDir, "wix-reviews.snapshot.json"),
    JSON.stringify({ extracted_at: extractedAt, count: reviews.length, reviews }, null, 2)
  );

  writeFileSync(
    join(dataDir, "wix-product-id-map.json"),
    JSON.stringify({ extracted_at: extractedAt, count: Object.keys(products).length, products }, null, 2)
  );

  console.log(`Saved ${reviews.length} Wix reviews and ${Object.keys(products).length} product mappings.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
