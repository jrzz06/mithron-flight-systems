# Quick Start: Background Removal & Supabase Upload

## TL;DR - 3 Steps

### Step 1: Remove Backgrounds

**Best Quality (Python - Recommended):**
```bash
pip install rembg pillow
python scripts/remove-backgrounds.py
```

**Alternative (Node.js):**
```bash
npm run assets:remove-backgrounds
```

### Step 2: Verify Results
```bash
npm run dev
# Check at: http://localhost:3000/media/mithron/mission/agrone/
# Images should show checkered background (transparency)
```

### Step 3: Upload to Supabase
```bash
npm run assets:upload-backgrounds
```

---

## What Gets Processed?

**Agri Community World** (5 images)
- `public/media/mithron/mission/agrone/agrone-pilot-registration.png`
- `public/media/mithron/mission/agrone/agrone-drone-owner-registration.png`
- `public/media/mithron/mission/agrone/smart-farmer-register.png`
- `public/media/mithron/mission/agrone/agri-drone-loan.png`
- `public/media/mithron/mission/agrone/all-india-drone-farmer.png`

**City Drone World** (5 images)
- `public/media/mithron/mission/city/traffic-analytics.png`
- `public/media/mithron/mission/city/smart-city-monitoring.png`
- `public/media/mithron/mission/city/infrastructure-inspection.png`
- `public/media/mithron/mission/city/crowd-monitoring.png`
- `public/media/mithron/mission/city/emergency-response.png`

---

## Background Removal Methods

| Method | Quality | Speed | Cost | Command |
|--------|---------|-------|------|---------|
| **Python (rembg)** | ⭐⭐⭐⭐⭐ Excellent | Fast | Free | `python scripts/remove-backgrounds.py` |
| **remove.bg API** | ⭐⭐⭐⭐⭐ Excellent | Fast | $$ | Set `REMOVE_BG_API_KEY` + `npm run assets:remove-backgrounds` |
| **Node.js (local)** | ⭐⭐ Basic | Fast | Free | `npm run assets:remove-backgrounds` |
| **Manual** | ⭐⭐⭐⭐⭐ Custom | Slow | Free | Use Photoshop/GIMP/remove.bg web |

### Recommended: Python (rembg)
- Best quality AI-powered removal
- Free and unlimited
- Simple one-liner command
- Requires Python 3.6+

---

## Setup Requirements

### For Python Method
```bash
# Install Python 3.6+ from python.org
# Then:
pip install rembg pillow
```

### For Supabase Upload
Set environment variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_STORAGE_BUCKET=mithron-images  # optional, defaults to mithron-images
```

---

## Troubleshooting

### Python Not Found
```bash
# Check if Python is installed
python --version
# or
python3 --version

# If not, download from: https://www.python.org/downloads/
```

### rembg Module Not Found
```bash
pip install --upgrade rembg pillow
```

### Supabase Upload Fails
1. Check environment variables are set
2. Verify Supabase bucket exists (or it will be auto-created)
3. Check service role key has storage permissions

### Images Still Have Backgrounds
- Try Python method (best quality)
- Or manually remove backgrounds using remove.bg website
- Or use Photoshop/GIMP

---

## What Happens After Upload?

### Option A: Keep Local + Supabase
- Local images serve faster
- Supabase is backup/CDN
- Good for version control

### Option B: Switch to Supabase Only
```tsx
// In home-landing-composite.tsx, update:
agronePilotRegistration: {
  src: "https://your-project.supabase.co/storage/v1/object/public/mithron-images/media/mithron/mission/agrone/agrone-pilot-registration.png",
  // ...
}
```

### Option C: Use Supabase Client
```tsx
const imageUrl = supabase.storage
  .from('mithron-images')
  .getPublicUrl('media/mithron/mission/agrone/agrone-pilot-registration.png')
  .data.publicUrl;
```

---

## Full Guide

For detailed information, see: [`scripts/BACKGROUND_REMOVAL_GUIDE.md`](BACKGROUND_REMOVAL_GUIDE.md)

---

## Files Created

- `scripts/remove-backgrounds.py` - Python background removal (recommended)
- `scripts/remove-backgrounds.mjs` - Node.js fallback
- `scripts/upload-to-supabase.mjs` - Upload processed images
- `scripts/BACKGROUND_REMOVAL_GUIDE.md` - Full documentation
- `package.json` - Added npm scripts:
  - `npm run assets:remove-backgrounds`
  - `npm run assets:upload-backgrounds`

