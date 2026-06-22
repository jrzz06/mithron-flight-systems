import { assertSupabaseAdminConfig } from "@/lib/env";
import { requirePermission } from "@/services/auth";
import { provisionAuthenticatedUserIfMissing } from "@/services/auth-provisioning";
import {
  createAdminRecord,
  fetchAdminRecordsByColumn,
  updateAdminRecord
} from "@/services/admin-actions";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

const supplierProductMutationOptions = {
  guard: () => requirePermission("products.submit")
};

export { supplierProductMutationOptions };

async function ensureSupplierProfile(userId: string, env: EnvSource = process.env) {
  await provisionAuthenticatedUserIfMissing({ userId, preferredRole: "supplier" }, env);
}

function mapSupplierProductError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("code=23505") || message.includes("duplicate key")) {
    return new Error("A product with this slug already exists. Change the slug or product name.");
  }
  if (message.includes("code=23503") || message.includes("is not present in table \"profiles\"")) {
    return new Error("Your supplier profile is not set up yet. Sign out and sign in again, then retry.");
  }
  if (message.includes("code=23514") || message.includes("workflow_status")) {
    return new Error("Product workflow status is invalid. Contact support — database migrations may be pending.");
  }
  return error instanceof Error ? error : new Error(message);
}

async function assertProductSlugAvailable(slug: string, env: EnvSource = process.env) {
  const existing = await fetchAdminRecordsByColumn("mithron_products", "slug", slug, env);
  if (existing.length) {
    throw new Error("A product with this slug already exists. Change the slug or product name.");
  }
}

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

export async function listSupplierProducts(supplierId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?select=slug,name,category,price,tagline,workflow_status,rejection_reason,is_visible,updated_at&supplier_id=eq.${supplierId}&order=updated_at.desc&limit=100`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function createSupplierProductDraft(
  supplierId: string,
  payload: JsonRecord,
  actorId: string,
  env: EnvSource = process.env
) {
  await ensureSupplierProfile(supplierId, env);
  const slug = String(payload.slug ?? "").trim();
  if (slug) await assertProductSlugAvailable(slug, env);

  try {
    return await createAdminRecord(
      "mithron_products",
      {
        ...payload,
        supplier_id: supplierId,
        submitted_by: actorId,
        workflow_status: "draft",
        is_visible: false
      },
      actorId,
      env,
      supplierProductMutationOptions
    );
  } catch (error) {
    throw mapSupplierProductError(error);
  }
}

export async function updateSupplierOwnedProduct(
  supplierId: string,
  slug: string,
  payload: JsonRecord,
  actorId: string,
  env: EnvSource = process.env,
  options: { expectedUpdatedAt?: string | null } = {}
) {
  await ensureSupplierProfile(supplierId, env);
  const existing = await fetchAdminRecordsByColumn("mithron_products", "slug", slug, env);
  const product = existing[0];
  if (!product || String(product.supplier_id ?? "") !== supplierId) {
    throw new Error("Supplier cannot modify products they do not own.");
  }
  const status = String(product.workflow_status ?? "draft");
  if (!["draft", "rejected"].includes(status)) {
    throw new Error("Supplier can only edit draft or rejected products.");
  }
  try {
    return await updateAdminRecord("mithron_products", "slug", slug, payload, actorId, env, {
      ...supplierProductMutationOptions,
      expectedUpdatedAt: options.expectedUpdatedAt ?? null
    });
  } catch (error) {
    throw mapSupplierProductError(error);
  }
}

export async function submitSupplierProductForReview(
  supplierId: string,
  slug: string,
  actorId: string,
  env: EnvSource = process.env
) {
  await ensureSupplierProfile(supplierId, env);
  const existing = await fetchAdminRecordsByColumn("mithron_products", "slug", slug, env);
  const product = existing[0];
  if (!product || String(product.supplier_id ?? "") !== supplierId) {
    throw new Error("Supplier cannot submit products they do not own.");
  }
  const status = String(product.workflow_status ?? "draft");
  if (!["draft", "rejected"].includes(status)) {
    throw new Error("Only draft or rejected products can be submitted for review.");
  }
  try {
    return await updateAdminRecord(
      "mithron_products",
      "slug",
      slug,
      {
        workflow_status: "pending_review",
        submitted_by: actorId,
        rejection_reason: null,
        updated_at: new Date().toISOString()
      },
      actorId,
      env,
      supplierProductMutationOptions
    );
  } catch (error) {
    throw mapSupplierProductError(error);
  }
}

export async function countPendingSupplierProducts(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?select=slug&workflow_status=eq.pending_review&limit=1`,
    {
      headers: {
        ...headers(config.serviceRoleKey),
        Prefer: "count=exact"
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return 0;
  const countHeader = response.headers.get("content-range");
  if (!countHeader) return 0;
  const match = countHeader.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export async function deleteSupplierOwnedProduct(
  supplierId: string,
  slug: string,
  actorId: string,
  env: EnvSource = process.env
) {
  await ensureSupplierProfile(supplierId, env);
  void actorId;
  const existing = await fetchAdminRecordsByColumn("mithron_products", "slug", slug, env);
  const product = existing[0];
  if (!product || String(product.supplier_id ?? "") !== supplierId) {
    throw new Error("Supplier cannot delete products they do not own.");
  }
  const status = String(product.workflow_status ?? "draft");
  if (!["draft", "rejected"].includes(status)) {
    throw new Error("Only draft or rejected products can be deleted by the supplier.");
  }
  const productName = String(product.name ?? slug);

  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?slug=eq.${encodeURIComponent(slug)}`,
    {
      method: "DELETE",
      headers: { ...headers(config.serviceRoleKey), Prefer: "return=representation" }
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete product: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ""}`);
  }
  return productName;
}

export async function getSupplierOwnedProduct(supplierId: string, slug: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?select=slug,name,category,price,tagline,image,hero,workflow_status,rejection_reason,supplier_id,is_visible,updated_at&slug=eq.${encodeURIComponent(slug)}&supplier_id=eq.${supplierId}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as JsonRecord[];
  return rows[0] ?? null;
}

export async function listAdminUserIds(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/user_roles?select=user_id&role_key=eq.admin&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ user_id?: string }>;
  return rows.map((row) => String(row.user_id ?? "")).filter(Boolean);
}

export async function listSupplierInventory(supplierId: string, env: EnvSource = process.env) {
  const products = await listSupplierProducts(supplierId, env);
  const slugs = products.map((product) => String(product.slug)).filter(Boolean);
  if (!slugs.length) return [];
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/inventory?select=id,product_slug,sku,stock_status,quantity,reorder_threshold,updated_at&product_slug=in.(${slugs.map(encodeURIComponent).join(",")})&order=updated_at.desc&limit=200`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}
