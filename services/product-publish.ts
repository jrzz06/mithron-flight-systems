import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { ensureInventoryForPublishedProduct } from "@/services/product-inventory-sync";

type JsonRecord = Record<string, unknown>;

export async function assertProductCanPublish(slug: string, options?: { requireSupplier?: boolean }) {
  const rows = await fetchAdminRecordsByColumn("mithron_products", "slug", slug);
  const product = rows[0] as JsonRecord | undefined;
  if (!product) {
    throw new Error(`Product ${slug} was not found.`);
  }

  const supplierId = String(product.supplier_id ?? "").trim();
  const submissionStatus = String(product.workflow_status ?? "");
  const isSupplierSubmission = submissionStatus === "pending_review" || Boolean(supplierId);

  if (options?.requireSupplier !== false && isSupplierSubmission && !supplierId) {
    throw new Error(`Product ${slug} cannot publish without a supplier_id.`);
  }

  return product;
}

/** Single publish path: validate, seed Supabase inventory rows, return product snapshot. */
export async function publishProductToStorefront(slug: string, actorId: string | null) {
  const product = await assertProductCanPublish(slug);
  await ensureInventoryForPublishedProduct(slug, actorId);
  return product;
}

export async function markProductPublished(
  slug: string,
  actorId: string | null,
  extraFields: JsonRecord = {}
) {
  await publishProductToStorefront(slug, actorId);
  const now = new Date().toISOString();
  return updateAdminRecord(
    "mithron_products",
    "slug",
    slug,
    {
      workflow_status: "published",
      is_visible: true,
      published_at: now,
      updated_at: now,
      ...extraFields
    },
    actorId
  );
}
