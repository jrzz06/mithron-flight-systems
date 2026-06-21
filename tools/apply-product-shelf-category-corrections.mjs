import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional local env file.
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const corrections = [
  {
    slug: "source-nuno-no-tc-required",
    category: "Surveillance Drones",
    interests: ["surveillance"]
  },
  {
    slug: "source-monal-4k",
    category: "Surveillance Drones",
    interests: ["surveillance"]
  },
  {
    slug: "source-monal-4k-thermal",
    category: "Surveillance Drones",
    interests: ["surveillance"]
  },
  ...[
    "source-decafly-d5x-battery-frame",
    "source-18-inch-drone-frame",
    "source-siyi-a2-mini-ultra-wide-angle-fpv-gimbal-single-axis-camera-sensor",
    "source-skydroid-h12-with-inbuilt-screen-and-camera-remote-control",
    "source-15-inch-drone-frame",
    "source-decafly-d5x-cfrp-arm-black",
    "source-skydroid-c10-three-axis-gimbal-camera",
    "source-decafly-d5x-3d-printed-arm-white",
    "source-siyi-a8-mini-4k-8mp-ultra-hd-6x-digital-zoom-gimbal-camera",
    "source-decafly-d5x-landing-gear",
    "source-jiyi-terrain-following-radar-for-agriculture-drones",
    "source-skyrc-pc1080-dual-channel-charger-for-agriculture-drone-batteries",
    "source-decafly-d5x-cfrp-frame"
  ].map((slug) => ({
    slug,
    category: "Accessories",
    interests: ["components"]
  }))
];

for (const correction of corrections) {
  const response = await fetch(`${url}/rest/v1/mithron_products?slug=eq.${encodeURIComponent(correction.slug)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      category: correction.category,
      interests: correction.interests
    })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to update ${correction.slug}: ${response.status} ${body}`);
    process.exit(1);
  }

  const rows = await response.json();
  console.log(`Updated ${correction.slug} -> ${rows[0]?.category ?? correction.category}`);
}

console.log(`Applied ${corrections.length} product shelf category corrections.`);
