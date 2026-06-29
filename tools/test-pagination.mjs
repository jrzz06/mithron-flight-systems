const BASE = "https://final-mithron-deploy.vercel.app";

async function testPagination() {
  for (let page = 1; page <= 5; page++) {
    const url =
      page === 1 ? `${BASE}/category/accessories` : `${BASE}/category/accessories?page=${page}`;
    const res = await fetch(url);
    const html = await res.text();
    const slugs = [
      ...new Set([...html.matchAll(/href="\/product\/([^"?#]+)"/g)].map((m) => m[1]))
    ];
    console.log(
      `page ${page}: status ${res.status}, products ${slugs.length}, has source-namoag: ${slugs.includes("source-namoag")}`
    );
  }
}

testPagination().catch(console.error);
