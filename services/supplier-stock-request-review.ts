import { assertSupabaseAdminConfig } from "@/lib/env";
import { prepareEditorHtmlForDisplay } from "@/lib/editor/prepare-html";
import { readProductImageSrc } from "@/lib/supplier/product-image";
import { deriveProductSku } from "@/services/product-inventory-sync";
import { listPendingStockRequests } from "@/services/supplier-stock-requests";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

export type StockRequestReviewFlag = {
  tone: "warning" | "info";
  message: string;
};

export type StockRequestReviewItem = {
  requestId: string;
  productSlug: string;
  requestedQuantity: number;
  snapshotQuantity: number;
  liveQuantity: number;
  quantityDelta: number;
  resultingQuantity: number;
  note: string | null;
  submittedAt: string;
  requestStatus: string;
  product: {
    name: string;
    category: string;
    workflowStatus: string;
    updatedAt: string;
    sellingPrice: number;
    compareAt: number | null;
    discountSummary: string | null;
    brandLabel: string;
    descriptionHtml: string;
    primaryImageSrc: string;
    gallerySrcs: string[];
  };
  supplier: {
    id: string;
    label: string;
    email: string;
  };
  inventory: {
    sku: string;
    stockStatus: string;
  };
  flags: StockRequestReviewFlag[];
};

function adminHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

function readGallerySrcs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readProductImageSrc(item)).filter(Boolean);
}

function formatDiscountSummary(product: JsonRecord): string | null {
  if (!product.on_sale) return null;
  const type = String(product.discount_type ?? "");
  const value = Number(product.discount_value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "On sale";
  if (type === "percent") return `${value}% off`;
  if (type === "amount") return `₹${value} off`;
  return "On sale";
}

export function assessStockRequestReviewFlags(input: {
  requestedQuantity: number;
  liveQuantity: number;
  snapshotQuantity: number;
  workflowStatus: string;
}): StockRequestReviewFlag[] {
  const flags: StockRequestReviewFlag[] = [];
  const delta = input.requestedQuantity - input.liveQuantity;

  if (input.workflowStatus !== "published") {
    flags.push({
      tone: "warning",
      message: `Product workflow status is "${input.workflowStatus}" — confirm catalog readiness before applying stock.`
    });
  }

  if (delta < 0) {
    flags.push({
      tone: "warning",
      message: `Requested quantity is ${Math.abs(delta)} units below current catalog stock.`
    });
  }

  if (input.liveQuantity > 0 && input.requestedQuantity >= input.liveQuantity * 5) {
    flags.push({
      tone: "warning",
      message: "Requested stock is at least 5× the current catalog quantity."
    });
  }

  if (input.requestedQuantity >= 10_000) {
    flags.push({
      tone: "warning",
      message: "Requested stock is unusually high (10,000+ units)."
    });
  }

  if (input.snapshotQuantity !== input.liveQuantity) {
    flags.push({
      tone: "info",
      message: `Catalog stock changed since submission (${input.snapshotQuantity} → ${input.liveQuantity}).`
    });
  }

  if (!flags.length) {
    flags.push({
      tone: "info",
      message: "No unusual patterns detected for this request."
    });
  }

  return flags;
}

async function fetchRecordsByColumnIn<T extends JsonRecord>(
  table: string,
  column: string,
  values: string[],
  select: string,
  env: EnvSource
): Promise<T[]> {
  if (!values.length) return [];
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/${table}?select=${select}&${column}=in.(${values.map(encodeURIComponent).join(",")})`,
    { headers: adminHeaders(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as T[];
}

export async function listPendingStockRequestsForReview(env: EnvSource = process.env): Promise<StockRequestReviewItem[]> {
  const pending = await listPendingStockRequests(env);
  if (!pending.length) return [];

  const productSlugs = [...new Set(pending.map((row) => String(row.product_slug ?? "")).filter(Boolean))];
  const supplierIds = [...new Set(pending.map((row) => String(row.supplier_id ?? "")).filter(Boolean))];

  const [products, profiles, inventoryRows] = await Promise.all([
    fetchRecordsByColumnIn<JsonRecord>(
      "mithron_products",
      "slug",
      productSlugs,
      "slug,name,category,price,compare_at,on_sale,discount_type,discount_value,description,image,hero,gallery,workflow_status,badge,updated_at,supplier_id",
      env
    ),
    fetchRecordsByColumnIn<{ id?: string; email?: string; display_name?: string }>(
      "profiles",
      "id",
      supplierIds,
      "id,email,display_name",
      env
    ),
    fetchRecordsByColumnIn<JsonRecord>(
      "inventory",
      "product_slug",
      productSlugs,
      "product_slug,sku,quantity,stock_status",
      env
    )
  ]);

  const productBySlug = new Map(products.map((product) => [String(product.slug), product]));
  const profileById = new Map(
    profiles.map((profile) => [
      String(profile.id ?? ""),
      {
        label: profile.display_name || profile.email || String(profile.id ?? "Unknown supplier"),
        email: String(profile.email ?? "")
      }
    ])
  );
  const inventoryBySlug = new Map(inventoryRows.map((row) => [String(row.product_slug), row]));

  return pending.map((request) => {
    const productSlug = String(request.product_slug ?? "");
    const product = productBySlug.get(productSlug) ?? {};
    const supplierId = String(request.supplier_id ?? "");
    const supplierProfile = profileById.get(supplierId) ?? { label: "Unknown supplier", email: "" };
    const inventory = inventoryBySlug.get(productSlug) ?? {};
    const requestedQuantity = Number(request.requested_quantity ?? 0);
    const snapshotQuantity = Number(request.current_quantity ?? 0);
    const liveQuantity = Number(inventory.quantity ?? snapshotQuantity);
    const primaryImageSrc = readProductImageSrc(product.image) || readProductImageSrc(product.hero);
    const gallerySrcs = readGallerySrcs(product.gallery).filter((src) => src !== primaryImageSrc);
    const workflowStatus = String(product.workflow_status ?? "unknown");
    const descriptionRaw = typeof product.description === "string" ? product.description : "";

    return {
      requestId: String(request.id ?? ""),
      productSlug,
      requestedQuantity,
      snapshotQuantity,
      liveQuantity,
      quantityDelta: requestedQuantity - liveQuantity,
      resultingQuantity: requestedQuantity,
      note: typeof request.note === "string" && request.note.trim() ? request.note.trim() : null,
      submittedAt: String(request.created_at ?? ""),
      requestStatus: String(request.status ?? "pending"),
      product: {
        name: String(product.name ?? productSlug),
        category: String(product.category ?? "Uncategorized"),
        workflowStatus,
        updatedAt: String(product.updated_at ?? ""),
        sellingPrice: Number(product.price ?? 0),
        compareAt: product.compare_at == null ? null : Number(product.compare_at),
        discountSummary: formatDiscountSummary(product),
        brandLabel: typeof product.badge === "string" && product.badge.trim() ? product.badge.trim() : "—",
        descriptionHtml: descriptionRaw ? prepareEditorHtmlForDisplay(descriptionRaw) : "",
        primaryImageSrc,
        gallerySrcs
      },
      supplier: {
        id: supplierId,
        label: supplierProfile.label,
        email: supplierProfile.email || "—"
      },
      inventory: {
        sku: String(inventory.sku ?? deriveProductSku(productSlug)),
        stockStatus: String(inventory.stock_status ?? "unknown")
      },
      flags: assessStockRequestReviewFlags({
        requestedQuantity,
        liveQuantity,
        snapshotQuantity,
        workflowStatus
      })
    };
  });
}
