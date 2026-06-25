import { ProductFieldLabel } from "@/components/admin/product-info-tooltip";
import {
  PRODUCT_BADGE_STYLE_LABELS,
  PRODUCT_BADGE_STYLES,
  PRODUCT_BADGE_TEXT_MAX,
  normalizeProductBadgeStyle,
  type ProductBadgeStyle
} from "@/lib/product-badge";

export function ProductBadgeFields({
  enabled = false,
  text = "",
  style = "default"
}: {
  enabled?: boolean;
  text?: string;
  style?: ProductBadgeStyle | string;
}) {
  const normalizedStyle = normalizeProductBadgeStyle(style);

  return (
    <section data-product-badge-fields className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-muted)]">
          Product badge
        </p>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--platform-text-secondary)]">
          <input
            type="checkbox"
            name="badge_enabled"
            value="true"
            defaultChecked={enabled}
            className="size-4 rounded border-[var(--platform-border)]"
          />
          Show badge
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <ProductFieldLabel tooltip="Short promotional label shown on product cards when enabled.">
            Badge text
          </ProductFieldLabel>
          <input
            name="badge_text"
            defaultValue={text}
            maxLength={PRODUCT_BADGE_TEXT_MAX}
            placeholder="Best Seller"
            className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)] focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <ProductFieldLabel tooltip="Visual style identifier stored in the database.">
            Badge style
          </ProductFieldLabel>
          <select
            name="badge_style"
            defaultValue={normalizedStyle}
            className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
          >
            {PRODUCT_BADGE_STYLES.map((option) => (
              <option key={option} value={option}>
                {PRODUCT_BADGE_STYLE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
