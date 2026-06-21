import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const LOCAL_PATH_ALIASES = {
  "/media/mithron/hero/ag10-command.webp": "/assets/hero/hero-slide-01.webp",
  "/media/mithron/hero/mapping-flight.webp": "/assets/hero/hero-slide-02.webp",
  "/media/mithron/hero/security-grid.webp": "/assets/hero/hero-slide-04.webp"
};

function resolveLocal(src) {
  const trimmed = (src ?? "").trim();
  if (!trimmed.startsWith("/")) return null;
  return LOCAL_PATH_ALIASES[trimmed] ?? trimmed;
}

function extractSrcStrings(text) {
  const matches = [];
  const re = /(?:src|imageSrc|heroImageSrc|image_src):\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(text))) matches.push(m[1]);
  return matches;
}

function collectFromHomepageCmsDefaults() {
  const file = path.join(ROOT, "config", "homepage-cms.ts");
  const text = fs.readFileSync(file, "utf8");
  return extractSrcStrings(text).map((src) => ({ source: "homepage-cms-defaults", section: "cms", src }));
}

function collectFromLocalMedia() {
  const file = path.join(ROOT, "sections", "home", "home-landing-composite.tsx");
  const text = fs.readFileSync(file, "utf8");
  const block = text.match(/const localMedia = \{([\s\S]*?)\} satisfies/)?.[1] ?? "";
  return extractSrcStrings(block).map((src) => ({ source: "localMedia-fallback", section: "composite", src }));
}

const HERO_DB = [
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-01.webp", id: "ag10-arrival" },
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-02.webp", id: "mapping-flight" },
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-02.webp", id: "mapping-flight-poster", role: "poster" },
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-03.webp", id: "drone-ecosystem" },
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-03.webp", id: "drone-ecosystem-poster", role: "poster" },
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-04.webp", id: "surveillance-grid" },
  { source: "hero_banners-db", section: "hero-carousel", src: "/assets/hero/hero-slide-04.webp", id: "surveillance-grid-poster", role: "poster" }
];

const TRUST_DB = [
  "/optimized/product-cutouts/source-10l-agri-spraycopter.webp",
  "/optimized/product-cutouts/source-v9-flight-controller-for-agriculture-drones.webp",
  "/optimized/product-cutouts/source-mk2-flight-core.webp",
  "/optimized/product-cutouts/source-hobbywing-x6-plus-motor-with-propeller-combo.webp",
  "/optimized/product-cutouts/source-drone-decafly-d5x.webp",
  "/optimized/product-cutouts/source-transmitter-and-receiver-h12.webp",
  "/optimized/product-cutouts/source-gnss-receiver-rs2-with-tripod-and-tribrach.webp"
].map((src, i) => ({ source: "trust_cards-db", section: "cms-trust", src, id: `trust-${i + 1}` }));

async function inspectLocalFile(resolvedPath) {
  const abs = path.join(PUBLIC, resolvedPath.replace(/^\//, ""));
  if (!fs.existsSync(abs)) {
    return { exists: false, abs };
  }
  const stat = fs.statSync(abs);
  const buf = fs.readFileSync(abs);
  const hash = crypto.createHash("md5").update(buf).digest("hex");
  const meta = await sharp(buf).metadata();
  return {
    exists: true,
    abs,
    bytes: stat.size,
    kb: Math.round(stat.size / 1024),
    format: meta.format,
    width: meta.width,
    height: meta.height,
    aspect: meta.width && meta.height ? Number((meta.width / meta.height).toFixed(3)) : null,
    hash
  };
}

function normalizeUrlKey(src) {
  if (src.startsWith("http")) {
    try {
      const u = new URL(src);
      return `${u.origin}${u.pathname}`;
    } catch {
      return src;
    }
  }
  return resolveLocal(src) ?? src;
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

async function main() {
  const entries = [
    ...collectFromHomepageCmsDefaults(),
    ...collectFromLocalMedia(),
    ...HERO_DB,
    ...TRUST_DB
  ];

  const seenUsage = new Map();
  for (const entry of entries) {
    const key = `${entry.source}|${entry.section}|${entry.src}|${entry.id ?? ""}|${entry.role ?? ""}`;
    if (!seenUsage.has(key)) seenUsage.set(key, entry);
  }
  const uniqueUsages = [...seenUsage.values()];

  const inspected = [];
  for (const entry of uniqueUsages) {
    const resolved = resolveLocal(entry.src);
    const isRemote = entry.src.startsWith("http");
    const row = {
      ...entry,
      resolved: resolved ?? entry.src,
      kind: isRemote ? "remote" : "local"
    };
    if (!isRemote && resolved) {
      row.file = await inspectLocalFile(resolved);
    }
    inspected.push(row);
  }

  const localFiles = inspected.filter((r) => r.kind === "local");
  const existing = localFiles.filter((r) => r.file?.exists);
  const missing = localFiles.filter((r) => !r.file?.exists);

  const byHash = groupBy(existing, (r) => r.file.hash);
  const hashDupes = [...byHash.entries()].filter(([, list]) => list.length > 1);

  const byResolved = groupBy(inspected, (r) => normalizeUrlKey(r.resolved));
  const urlDupes = [...byResolved.entries()].filter(([, list]) => {
    const sources = new Set(list.map((x) => x.source));
    return list.length > 1 && sources.size > 1;
  });

  const byFormat = groupBy(existing, (r) => r.file.format ?? "unknown");
  const formatCounts = Object.fromEntries([...byFormat.entries()].map(([k, v]) => [k, v.length]));

  const dims = existing.map((r) => ({ src: r.resolved, w: r.file.width, h: r.file.height, kb: r.file.kb }));
  const oversized = dims.filter((d) => (d.w ?? 0) > 2560 || (d.kb ?? 0) > 800);
  const pngs = existing.filter((r) => r.file.format === "png");
  const webps = existing.filter((r) => r.file.format === "webp");

  const cmsAgri = inspected.filter((r) => r.src.includes("/agri-redesign/"));
  const localAgriFallback = inspected.filter((r) =>
    r.source === "localMedia-fallback" &&
    ["/media/mithron/dynamic-scroll/agriculture-flight.webp", "/media/mithron/mission/crop-health.webp", "/media/mithron/mission/precision-spray.webp", "/media/mithron/interests/agriculture.webp", "/media/mithron/interests/smart-farming.webp"].includes(r.src)
  );

  const report = {
    summary: {
      totalUsagesTracked: entries.length,
      uniqueUsages: uniqueUsages.length,
      localAssets: localFiles.length,
      localExisting: existing.length,
      localMissing: missing.length,
      remoteAssets: inspected.filter((r) => r.kind === "remote").length,
      duplicateFileHashes: hashDupes.length,
      crossSourceUrlDuplicates: urlDupes.length,
      formats: formatCounts,
      pngCount: pngs.length,
      webpCount: webps.length,
      oversizedCount: oversized.length
    },
    missingFiles: missing.map((r) => ({ src: r.src, resolved: r.resolved, source: r.source, section: r.section })),
    duplicateHashes: hashDupes.map(([hash, list]) => ({
      hash,
      bytes: list[0].file.bytes,
      width: list[0].file.width,
      height: list[0].file.height,
      paths: list.map((r) => ({ resolved: r.resolved, source: r.source, section: r.section }))
    })),
    crossSourceDuplicates: urlDupes.map(([url, list]) => ({
      url,
      usages: list.map((r) => ({ src: r.src, source: r.source, section: r.section }))
    })),
    agriCmsVsFallback: {
      cmsAgriRedesignPaths: cmsAgri.map((r) => ({ src: r.src, exists: r.file?.exists ?? null, dims: r.file ? `${r.file.width}x${r.file.height}` : null, kb: r.file?.kb })),
      localFallbackStillInCode: localAgriFallback.map((r) => ({ src: r.src, resolved: r.resolved, exists: r.file?.exists }))
    },
    oversized,
    allLocalAssets: existing
      .sort((a, b) => (b.file.kb ?? 0) - (a.file.kb ?? 0))
      .map((r) => ({
        resolved: r.resolved,
        source: r.source,
        section: r.section,
        format: r.file.format,
        width: r.file.width,
        height: r.file.height,
        kb: r.file.kb,
        hash: r.file.hash.slice(0, 8)
      }))
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
