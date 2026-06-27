const BASE = "https://mithron-flight-systems-kbkbkh.vercel.app";

const checkSlugs = [
  "source-namoag",
  "source-aerofc-v2-flight-controller-compatible-with-open-source-firmware-and-gcs",
  "source-ag-fc-namoag-gps-with-aerogcs-green-software-combo",
  "source-aero-fc-v2-namoag-navigation-for-modern-agriculture-gps-combo",
  "source-ag-fc-with-aerogcs-green-combo"
];

async function main() {
  console.log("=== Live product page checks ===");
  for (const slug of checkSlugs) {
    const res = await fetch(`${BASE}/product/${slug}`, { redirect: "follow" });
    console.log(`${res.status} ${slug}`);
  }

  const catRes = await fetch(`${BASE}/category/accessories`);
  const html = await catRes.text();
  const hrefs = [...new Set([...html.matchAll(/href="\/product\/([^"]+)"/g)].map((m) => m[1]))];
  console.log(`\nAccessories category: ${catRes.status}, unique product links: ${hrefs.length}`);

  for (const slug of checkSlugs) {
    const found = hrefs.includes(slug);
    console.log(`${found ? "ON PAGE" : "NOT ON PAGE"} ${slug}`);
  }

  const sitemapRes = await fetch(`${BASE}/sitemap.xml`);
  const sitemap = await sitemapRes.text();
  const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const productLocs = locs.filter((u) => u.includes("/product/"));
  console.log(`\nSitemap: ${locs.length} total URLs, ${productLocs.length} product URLs`);
}

main().catch(console.error);
