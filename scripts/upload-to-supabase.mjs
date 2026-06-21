#!/usr/bin/env node
/**
 * Upload processed images to Supabase Storage
 *
 * Usage:
 *   npm run upload-backgrounds
 *   node scripts/upload-to-supabase.mjs
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "mithron-images";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing required environment variables:");
  if (!SUPABASE_URL) console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_KEY) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface UploadResult {
  total: number;
  uploaded: number;
  failed: number;
  files: Array<{
    name: string;
    path: string;
    status: "success" | "failed";
    message?: string;
    url?: string;
  }>;
}

const uploadDirs = [
  {
    local: path.join(projectRoot, "public/media/mithron/mission/agrone"),
    remote: "media/mithron/mission/agrone",
    label: "Agri Community World",
  },
  {
    local: path.join(projectRoot, "public/media/mithron/mission/city"),
    remote: "media/mithron/mission/city",
    label: "City Drone World",
  },
];

async function uploadImages(): Promise<UploadResult> {
  const result: UploadResult = {
    total: 0,
    uploaded: 0,
    failed: 0,
    files: [],
  };

  console.log("🚀 Uploading Processed Images to Supabase");
  console.log("=".repeat(60));
  console.log(`📦 Bucket: ${STORAGE_BUCKET}`);
  console.log(`🔗 URL: ${SUPABASE_URL}`);
  console.log("");

  for (const dir of uploadDirs) {
    if (!fs.existsSync(dir.local)) {
      console.log(`⚠️  Directory not found: ${dir.local}`);
      continue;
    }

    console.log(`\n📁 ${dir.label}`);
    console.log("-".repeat(60));

    const files = fs.readdirSync(dir.local).filter((f) => f.endsWith(".png"));

    if (files.length === 0) {
      console.log("   No PNG files found");
      continue;
    }

    for (const file of files) {
      const filePath = path.join(dir.local, file);
      const remotePath = `${dir.remote}/${file}`;
      result.total++;

      try {
        process.stdout.write(`   Uploading: ${file}... `);

        const fileData = fs.readFileSync(filePath);

        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(remotePath, fileData, {
            contentType: "image/png",
            upsert: true, // Replace if exists
          });

        if (error) {
          throw new Error(error.message);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(remotePath);

        console.log("✅ Done");
        result.uploaded++;
        result.files.push({
          name: file,
          path: remotePath,
          status: "success",
          url: urlData?.publicUrl,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`❌ Failed: ${errorMessage}`);
        result.failed++;
        result.files.push({
          name: file,
          path: remotePath,
          status: "failed",
          message: errorMessage,
        });
      }
    }
  }

  return result;
}

async function main() {
  const result = await uploadImages();

  console.log("\n" + "=".repeat(60));
  console.log(`📊 Summary: ${result.uploaded} uploaded, ${result.failed} failed`);

  if (result.failed === 0) {
    console.log("✨ All images uploaded successfully!\n");

    // Show some uploaded URLs
    const successful = result.files.filter((f) => f.status === "success");
    if (successful.length > 0) {
      console.log("Sample URLs:");
      successful.slice(0, 3).forEach((f) => {
        console.log(`  • ${f.url}`);
      });
    }

    console.log("\nNext steps:");
    console.log("1. Update image references in code if paths changed");
    console.log("2. Test images in your application");
    console.log("3. Verify transparency in browser inspector");
  } else {
    console.log("\n⚠️  Some images failed to upload");
  }

  // Create a summary file
  const summaryPath = path.join(projectRoot, "upload-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
  console.log(`\n📝 Detailed summary saved to: upload-summary.json`);

  process.exit(result.failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
