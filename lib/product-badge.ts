export const PRODUCT_BADGE_STYLES = ["default", "success", "warning", "premium", "sale"] as const;

export type ProductBadgeStyle = (typeof PRODUCT_BADGE_STYLES)[number];

export const PRODUCT_BADGE_TEXT_MAX = 40;

export const PRODUCT_BADGE_STYLE_LABELS: Record<ProductBadgeStyle, string> = {
  default: "Default",
  success: "Success",
  warning: "Warning",
  premium: "Premium",
  sale: "Sale"
};

export type ProductBadgeRow = {
  badge_enabled?: boolean | null;
  badge_text?: string | null;
  badge_style?: string | null;
  badge?: string | null;
};

export type ResolvedProductBadge = {
  text: string;
  style: ProductBadgeStyle;
};

export function normalizeProductBadgeStyle(value: unknown): ProductBadgeStyle {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "default";
  return (PRODUCT_BADGE_STYLES as readonly string[]).includes(normalized)
    ? normalized as ProductBadgeStyle
    : "default";
}

export function resolveStorefrontProductBadge(row: ProductBadgeRow): ResolvedProductBadge | undefined {
  if (!row.badge_enabled) return undefined;

  const text = typeof row.badge_text === "string" ? row.badge_text.trim() : "";
  if (!text) return undefined;

  return {
    text,
    style: normalizeProductBadgeStyle(row.badge_style)
  };
}

export function resolveStorefrontBadgeText(row: ProductBadgeRow): string | undefined {
  return resolveStorefrontProductBadge(row)?.text;
}

export function readProductBadgeFieldsFromFormData(formData: FormData) {
  const hasBadgeFields = formData.has("badge_enabled")
    || formData.has("badge_text")
    || formData.has("badge_style");

  if (!hasBadgeFields) return null;

  const enabled = formData.get("badge_enabled") === "true" || formData.get("badge_enabled") === "on";
  const rawText = formData.get("badge_text");
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const style = normalizeProductBadgeStyle(formData.get("badge_style"));

  if (!PRODUCT_BADGE_STYLES.includes(style)) {
    throw new Error("Product badge style is invalid.");
  }

  if (enabled && !text) {
    throw new Error("Badge text is required when Show Badge is enabled.");
  }

  if (text.length > PRODUCT_BADGE_TEXT_MAX) {
    throw new Error(`Badge text must be ${PRODUCT_BADGE_TEXT_MAX} characters or fewer.`);
  }

  const badgeText = text || null;

  return {
    badge_enabled: enabled,
    badge_text: badgeText,
    badge_style: style,
    badge: enabled && badgeText ? badgeText : null
  };
}

export function productBadgeCssClass(style: ProductBadgeStyle, variant: "showroom" | "pill" = "showroom") {
  if (variant === "pill") {
    return `product-badge product-badge--${style}`;
  }
  return `product-badge-showroom product-badge-showroom--${style}`;
}
