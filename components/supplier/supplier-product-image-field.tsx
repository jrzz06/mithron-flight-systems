"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type SupplierProductImageDefaults = {
  imageSrc?: string;
  imageAlt?: string;
};

export function SupplierProductImageField({ defaults }: { defaults?: SupplierProductImageDefaults }) {
  const initialSrc = defaults?.imageSrc ?? "";
  const [previewSrc, setPreviewSrc] = useState(initialSrc);

  const showPreview = useMemo(() => Boolean(previewSrc.trim()), [previewSrc]);

  return (
    <div className="grid gap-3 rounded-lg border border-white/[0.08] bg-[#0c1118]/60 p-3" data-supplier-product-image-field>
      <div className="grid gap-1 text-sm">
        <span className="text-slate-300">Product image</span>
        <span className="text-xs text-slate-500">Upload a photo or paste a URL. Shown on catalog cards and the product page after approval.</span>
      </div>

      {showPreview ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/[0.08] bg-[#070b14]">
          <Image
            src={previewSrc}
            alt={defaults?.imageAlt || "Product preview"}
            fill
            unoptimized={previewSrc.startsWith("http")}
            className="object-contain p-2"
            sizes="(max-width: 768px) 100vw, 480px"
            onError={() => setPreviewSrc("")}
          />
        </div>
      ) : null}

      <label className="grid gap-1 text-sm">
        <span className="text-slate-400">Upload image</span>
        <input
          type="file"
          name="image_file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-violet-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-400">Or image URL</span>
        <input
          name="image_src"
          type="url"
          defaultValue={initialSrc}
          placeholder="https://... or /media/mithron/..."
          onChange={(event) => setPreviewSrc(event.target.value.trim())}
          className="rounded-lg border border-white/[0.08] bg-[#0b1017] px-3 py-2 text-slate-100"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-slate-400">Image alt text</span>
        <input
          name="image_alt"
          defaultValue={defaults?.imageAlt ?? ""}
          placeholder="Describe the product for accessibility"
          className="rounded-lg border border-white/[0.08] bg-[#0b1017] px-3 py-2 text-slate-100"
        />
      </label>
    </div>
  );
}
