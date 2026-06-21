#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadProjectEnv() {
  for (const envPath of [join(root, ".env.local"), join(root, ".env")]) {
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [name, ...parts] = trimmed.split("=");
      if (!name || process.env[name]) continue;
      process.env[name] = parts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

const shelfHeroImages = {
  droneWorld: {
    heroImageSrc: "/media/mithron/showcase/drone_world_hero.png",
    heroImageAlt: "Mithron drone fleet operating across a rugged mountain valley at golden hour"
  },
  droneCare: {
    heroImageSrc: "/media/mithron/showcase/drone_care_hero.png",
    heroImageAlt: "Mithron Drone Care complete kit with aircraft, controller, batteries, propellers, and service case"
  },
  globalProducts: {
    heroImageSrc: "/media/mithron/showcase/global_products_hero.png",
    heroImageAlt: "Global Drone Connect industrial drone carrying a shipping container over a digital logistics hub at night"
  }
};

async function main() {
  loadProjectEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("admin_settings").select("payload").eq("id", "global").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.payload) throw new Error("admin_settings global row is missing.");

  const payload = structuredClone(data.payload);
  const homepage = payload.homepage ?? {};
  const shelves = homepage.shelves ?? {};

  for (const [key, values] of Object.entries(shelfHeroImages)) {
    shelves[key] = { ...(shelves[key] ?? {}), ...values };
  }

  homepage.shelves = shelves;
  payload.homepage = homepage;

  const { error: updateError } = await supabase
    .from("admin_settings")
    .upsert({ id: "global", payload, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (updateError) throw new Error(updateError.message);
  console.log(JSON.stringify({ updated: Object.keys(shelfHeroImages), shelfHeroImages }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
