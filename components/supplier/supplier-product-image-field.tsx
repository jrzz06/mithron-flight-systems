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
    <div className="grid gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)]/60 p-3" data-supplier-product-image-field>
      <div className="grid gap-1 text-sm">
        <span className="text-[var(--platform-text-secondary)]">Product image</span>
        <span className="text-xs text-[var(--platform-text-muted)]">Upload a photo or paste a URL. Shown on catalog cards and the product page after approval.</span>
      </div>

      {showPreview ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
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
        <span className="text-[var(--platform-text-muted)]">Upload image</span>
        <input
          type="file"
          name="image_file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="platform-file-input block w-full text-sm text-[var(--platform-text-secondary)] file:mr-3"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--platform-text-muted)]">Or image URL</span>
        <input
          name="image_src"
          type="url"
          defaultValue={initialSrc}
          placeholder="https://example.com/your-product.jpg"
          onChange={(event) => setPreviewSrc(event.target.value.trim())}
          className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)]"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-[var(--platform-text-muted)]">Image description</span>
        <input
          name="image_alt"
          defaultValue={defaults?.imageAlt ?? ""}
          placeholder="Describe the product for accessibility"
          className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)]"
        />
      </label>
    </div>
  );
}
