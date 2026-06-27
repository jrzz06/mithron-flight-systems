const BASE = "https://mithron-flight-systems-kbkbkh.vercel.app";
const CATEGORIES = [
  "accessories",
  "agri-drones",
  "video-drones",
  "creative-drones",
  "surveillance-drones",
  "global-products"
];

async function fetchAllProductSlugsFromCategory(category) {
  const slugs = new Set();
  let page = 1;
  while (page <= 20) {
    const url = page === 1 ? `${BASE}/category/${category}` : `${BASE}/category/${category}?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const html = await res.text();
    const matches = [...html.matchAll(/href="\/product\/([^"?#]+)"/g)];
    const before = slugs.size;
    for (const m of matches) slugs.add(m[1]);
    if (slugs.size === before) break;
    page += 1;
  }
  return [...slugs];
}

async function main() {
  const all = new Set();
  const byCategory = {};
  for (const cat of CATEGORIES) {
    const slugs = await fetchAllProductSlugsFromCategory(cat);
    byCategory[cat] = slugs.length;
    for (const s of slugs) all.add(s);
    console.log(`${cat}: ${slugs.length} products on storefront`);
  }
  console.log(`\nTotal unique products on storefront category pages: ${all.size}`);
  return all;
}

main().catch(console.error);
