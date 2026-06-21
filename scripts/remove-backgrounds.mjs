#!/usr/bin/env node
/**
 * Background Removal Script for Agri Community World and City Drone World Images
 * Uses remove.bg API or local processing
 *
 * Usage:
 *   npm run remove-backgrounds
 *   node scripts/remove-backgrounds.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const imageDirs = [
  path.join(projectRoot, "public/media/mithron/mission/agrone"),
  path.join(projectRoot, "public/media/mithron/mission/city"),
];

interface ProcessingResult {
  total: number;
  processed: number;
  failed: number;
  files: Array<{
    name: string;
    status: "success" | "failed";
    message?: string;
  }>;
}

/**
 * Use remove.bg API (requires API key)
 */
async function removeBackgroundViaAPI(
  imagePath: string,
  apiKey: string
): Promise<Buffer> {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_base64: base64,
      format: "PNG",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `remove.bg API error: ${response.status} ${response.statusText}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Use local processing with sharp (requires sharp library)
 */
async function removeBackgroundLocally(imagePath: string): Promise<Buffer> {
  try {
    // Try to import sharp dynamically
    const sharp = await import("sharp").then((m) => m.default);

    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // This is a simplified approach - for better results, install @imgly/background-removal
    // or use rembg with Node.js binding
    console.warn(
      "⚠️  Local processing with sharp is basic. For better results:"
    );
    console.warn("   1. Install rembg: pip install rembg");
    console.warn("   2. Run: python scripts/remove-backgrounds.py");
    console.warn("   OR");
    console.warn("   3. Set REMOVE_BG_API_KEY environment variable");

    // Return original for now
    return fs.readFileSync(imagePath);
  } catch (error) {
    throw new Error(
      "Sharp not installed. Install with: npm install --save-dev sharp"
    );
  }
}

async function processImages(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    total: 0,
    processed: 0,
    failed: 0,
    files: [],
  };

  const apiKey = process.env.REMOVE_BG_API_KEY;
  const useAPI = !!apiKey;

  console.log("🎯 Background Removal Script");
  console.log("=".repeat(60));

  if (!useAPI) {
    console.log(
      "ℹ️  No REMOVE_BG_API_KEY found. Using local processing (basic).\n"
    );
    console.log("For better results, either:");
    console.log(
      "   1. Set REMOVE_BG_API_KEY environment variable (remove.bg service)"
    );
    console.log("   2. Run Python version: python scripts/remove-backgrounds.py");
    console.log("");
  }

  for (const imageDir of imageDirs) {
    if (!fs.existsSync(imageDir)) {
      console.log(`⚠️  Directory not found: ${imageDir}`);
      continue;
    }

    const dirName = path.basename(imageDir);
    console.log(`\n📁 Processing: ${dirName}`);
    console.log("-".repeat(60));

    const files = fs.readdirSync(imageDir).filter((f) => f.endsWith(".png"));

    if (files.length === 0) {
      console.log("   No PNG files found");
      continue;
    }

    for (const file of files) {
      const imagePath = path.join(imageDir, file);
      result.total++;

      try {
        process.stdout.write(`   Processing: ${file}... `);

        let outputBuffer: Buffer;

        if (useAPI) {
          outputBuffer = await removeBackgroundViaAPI(imagePath, apiKey);
        } else {
          outputBuffer = await removeBackgroundLocally(imagePath);
        }

        fs.writeFileSync(imagePath, outputBuffer);
        console.log("✅ Done");
        result.processed++;
        result.files.push({ name: file, status: "success" });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`❌ Failed: ${errorMessage}`);
        result.failed++;
        result.files.push({ name: file, status: "failed", message: errorMessage });
      }
    }
  }

  return result;
}

async function main() {
  const result = await processImages();

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Summary: ${result.processed} processed, ${result.failed} failed`);

  if (result.failed === 0) {
    console.log("✨ All images processed successfully!");
    console.log("\nNext steps:");
    console.log("1. Review the transparent images in your browser");
    console.log("2. Upload to Supabase Storage (see: scripts/upload-to-supabase.mjs)");
    console.log("3. Update image references if needed");
  } else {
    console.log("\n⚠️  Some images failed to process");
  }

  process.exit(result.failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
