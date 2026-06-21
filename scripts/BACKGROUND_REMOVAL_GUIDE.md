# Background Removal & Supabase Upload Guide

## Overview

This guide walks you through removing backgrounds from **Agri Community World** and **City Drone World** images and uploading them to Supabase Storage.

## Images to Process

### Agri Community World Images
Located in: `public/media/mithron/mission/agrone/`
- agrone-pilot-registration.png
- agrone-drone-owner-registration.png
- smart-farmer-register.png
- agri-drone-loan.png
- all-india-drone-farmer.png

### City Drone World Images
Located in: `public/media/mithron/mission/city/`
- traffic-analytics.png
- smart-city-monitoring.png
- infrastructure-inspection.png
- crowd-monitoring.png
- emergency-response.png

## Step 1: Remove Backgrounds

### Option A: Using Python (Recommended for Best Quality)

The Python version uses `rembg`, an AI-powered background removal tool that gives the best results.

**Setup:**
```bash
# Install Python requirements
pip install rembg pillow

# Run the script
python scripts/remove-backgrounds.py
```

**What it does:**
- Removes backgrounds from all PNG files
- Saves them with transparency (RGBA)
- Preserves original file paths
- Shows progress for each image

### Option B: Using Node.js with remove.bg API

For production-grade results using the remove.bg API service.

**Setup:**
```bash
# 1. Sign up for remove.bg: https://www.remove.bg
# 2. Get your API key from your account
# 3. Set environment variable
export REMOVE_BG_API_KEY="your-api-key-here"

# 4. Run the script
npm run remove-backgrounds
# or
node scripts/remove-backgrounds.mjs
```

**Limits:**
- Free tier: 50 API calls/month
- Paid tiers: higher limits available
- Each image = 1 API call

### Option C: Manual Processing

If you prefer to use your own tools:
1. Open images in Photoshop, GIMP, or online tool (e.g., remove.bg website)
2. Remove backgrounds manually
3. Export as PNG with transparency
4. Save back to the same directory

## Step 2: Verify Results

After processing, verify the images have transparent backgrounds:

```bash
# Open in browser (serves with transparency)
npm run dev
# Check images at:
# http://localhost:3000/media/mithron/mission/agrone/agrone-pilot-registration.png
# http://localhost:3000/media/mithron/mission/city/traffic-analytics.png
```

**Visual check in browser:**
- Right-click image → Inspect
- Verify PNG format and transparency support
- Images should show checkered background (transparency) in DevTools

## Step 3: Upload to Supabase Storage

### Prerequisites

Ensure environment variables are set:
```bash
# In your .env.local file:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Optional (defaults to "mithron-images"):
SUPABASE_STORAGE_BUCKET=mithron-images
```

### Upload Images

```bash
# Upload all processed images
npm run upload-backgrounds
# or
node scripts/upload-to-supabase.mjs
```

**What happens:**
1. Reads all PNG files from local directories
2. Uploads to Supabase Storage bucket
3. Generates public URLs
4. Creates `upload-summary.json` with results
5. Shows file paths and URLs

### Supabase Storage Setup (if needed)

If the bucket doesn't exist yet:

```bash
# Using Supabase CLI
supabase storage buckets create mithron-images

# Make it public (optional, for public access)
supabase storage buckets update mithron-images --public
```

Or via dashboard:
1. Go to Storage in Supabase dashboard
2. Click "Create new bucket"
3. Name: `mithron-images`
4. Select "Public" if you want public access
5. Click Create

## Step 4: Update Image References (Optional)

If you want to serve images from Supabase instead of local `/public`:

**Current (local):**
```tsx
media: localMedia.agronePilotRegistration, // src: "/media/mithron/mission/agrone/agrone-pilot-registration.png"
```

**New (Supabase):**
```tsx
media: {
  src: "https://your-project.supabase.co/storage/v1/object/public/mithron-images/media/mithron/mission/agrone/agrone-pilot-registration.png",
  alt: "...",
  caption: "...",
  sourceState: "VERIFIED"
}
```

Or use Supabase client:
```tsx
const imageUrl = supabase.storage
  .from('mithron-images')
  .getPublicUrl('media/mithron/mission/agrone/agrone-pilot-registration.png')
  .data.publicUrl;
```

## Troubleshooting

### Python Script Issues

**"ModuleNotFoundError: No module named 'rembg'"**
```bash
pip install rembg pillow
```

**"Module not found" on Windows**
```bash
python -m pip install rembg pillow
```

### Node.js Script Issues

**"Cannot find module '@supabase/supabase-js'"**
```bash
npm install @supabase/supabase-js
```

**"REMOVE_BG_API_KEY not recognized"**
```bash
# Windows PowerShell
$env:REMOVE_BG_API_KEY="your-key"

# Windows CMD
set REMOVE_BG_API_KEY=your-key

# Mac/Linux
export REMOVE_BG_API_KEY="your-key"
```

### Upload Fails

1. **Check environment variables:**
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Verify bucket exists:**
   - Open Supabase dashboard
   - Go to Storage
   - Check if `mithron-images` bucket exists

3. **Check permissions:**
   - Service role key should have storage write access
   - Bucket should not be restricted

## Cleanup

After successful upload, you can:

1. **Keep local copies** (recommended for version control):
   - Local files serve faster
   - Easier to rebuild/reprocess

2. **Delete local copies** (if using Supabase):
   ```bash
   rm public/media/mithron/mission/agrone/*.png
   rm public/media/mithron/mission/city/*.png
   ```

## Performance Tips

- **Batch processing:** Run during off-hours if using remove.bg API
- **Cache settings:** Update Next.js cache headers for transparent images
- **File size:** Transparent PNGs are usually smaller than originals with backgrounds
- **CDN:** Use Supabase CDN for geographic distribution

## Next Steps

1. ✅ Process images with background removal
2. ✅ Verify transparency locally
3. ✅ Upload to Supabase Storage
4. ⚠️ (Optional) Update image references in code
5. ⚠️ Test in staging/production environment
6. ⚠️ Update image cache settings if needed

## Support

For issues:
- **remove.bg API:** https://www.remove.bg/api
- **rembg library:** https://github.com/danielgatis/rembg
- **Supabase Storage:** https://supabase.com/docs/guides/storage
