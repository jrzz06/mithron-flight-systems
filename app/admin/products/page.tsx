import Link from "next/link";
import { DataList, ModulePanel, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getProductManagerSnapshot } from "@/services/admin";
import { deleteProductCategoryFormAction, saveProductCategoryFormAction, saveProductDraftFormAction, saveProductInventoryWorkflowFormAction, saveProductMediaLinkFormAction, saveProductPublishStateFormAction, saveProductSeoFormAction, saveProductVariantsFormAction } from "./actions";
import { resolveNextImageSrc } from "@/lib/media/next-image-src";
import { ProductCatalogGrid, type ProductCatalogGridRow } from "./product-catalog-grid";
import { ProductCategoryField, type ProductCategoryOption } from "./product-category-field";
import { connectivityMessage, emptyMessage } from "@/lib/platform/copy";
import { ProductCreateDetailFields } from "./product-create-detail-fields";

const platformFieldClass =
  "h-10 w-full rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)] focus:border-teal-600/30 focus:ring-2 focus:ring-teal-600/10";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function decodeMessage(value: string) {
  try {
    return value ? decodeURIComponent(value) : "";
  } catch {
    return value;
  }
}

function readMediaSrc(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const src = (value as Record<string, unknown>).src ?? (value as Record<string, unknown>).url;
  return typeof src === "string" && src.trim() ? src : null;
}

function uniqueCategoryOptions(products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>>) {
  const productCounts = new Map<string, { label: string; count: number }>();
  products.forEach((product) => {
    const value = product.category;
    if (typeof value !== "string" || !value.trim()) return;
    const category = value.trim();
    const key = category.toLowerCase();
    const current = productCounts.get(key);
    productCounts.set(key, {
      label: current?.label ?? category,
      count: (current?.count ?? 0) + 1
    });
  });

  const byLabel = new Map<string, ProductCategoryOption>();
  categories.forEach((category) => {
    const title = typeof category.title === "string" ? category.title.trim() : "";
    if (!title) return;
    const key = title.toLowerCase();
    const productCount = productCounts.get(key)?.count ?? 0;
    byLabel.set(key, {
      label: title,
      routeKey: typeof category.route_key === "string" && category.route_key.trim() ? category.route_key.trim() : null,
      productCount,
      metadataBacked: true
    });
  });

  productCounts.forEach((value, key) => {
    if (byLabel.has(key)) return;
    byLabel.set(key, {
      label: value.label,
      routeKey: null,
      productCount: value.count,
      metadataBacked: false
    });
  });

  return [...byLabel.values()];
}

const productTools = [
  { key: "create", label: "Add product", href: "/admin/products?tool=create#create-product" },
  { key: "category", label: "Add category", href: "/admin/products?tool=category#product-category" },
  { key: "variants", label: "Variants", href: "/admin/products?tool=variants#product-variants" },
  { key: "media", label: "Media", href: "/admin/products?tool=media#product-media" },
  { key: "seo", label: "SEO", href: "/admin/products?tool=seo#product-seo" },
  { key: "inventory", label: "Inventory", href: "/admin/products?tool=inventory#product-inventory" },
  { key: "publish", label: "Publish", href: "/admin/products?tool=publish#archive-product" }
] as const;

type ProductToolKey = (typeof productTools)[number]["key"];

function readProductTool(value: string): ProductToolKey | "" {
  return productTools.some((tool) => tool.key === value) ? value as ProductToolKey : "";
}

export default async function AdminProductsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getProductManagerSnapshot();
  const params = searchParams ? await searchParams : {};
  const query = searchValue(params, "q").toLowerCase();
  const statusFilter = searchValue(params, "workflow_status");
  const selectedProductSlug = searchValue(params, "product_slug");
  const activeTool = readProductTool(searchValue(params, "tool").toLowerCase());
  const productStatus = searchValue(params, "product_status");
  const productMessage = decodeMessage(searchValue(params, "product_message"));
  const categoryOptions = uniqueCategoryOptions(snapshot.data.products, snapshot.data.categories);
  const nextCategorySortOrder = (categoryOptions.length + 1) * 10;
  const filteredProducts = snapshot.data.products.filter((product) => {
    const workflow = String(product.workflow_status ?? "published");
    const haystack = `${String(product.name ?? "")} ${String(product.slug ?? "")} ${String(product.category ?? "")}`.toLowerCase();
    return (!statusFilter || workflow === statusFilter) && (!query || haystack.includes(query));
  });
  const activeProductSlug = selectedProductSlug || String(filteredProducts[0]?.slug ?? snapshot.data.products[0]?.slug ?? "");
  const lowStockCount = snapshot.data.inventory.filter((row) => {
    const quantity = Number(row.quantity ?? 0);
    const reorder = Number(row.reorder_threshold ?? 0);
    return Number.isFinite(quantity) && Number.isFinite(reorder) && reorder > 0 && quantity <= reorder;
  }).length;
  const inventoryBySlug = new Map(snapshot.data.inventory.map((row) => [String(row.product_slug ?? ""), row]));
  const stockBySlug = new Map(snapshot.data.stock.map((row) => [String(row.product_slug ?? ""), row]));
  const productRows: ProductCatalogGridRow[] = filteredProducts.map((product) => {
    const slug = String(product.slug ?? "");
    const inventory = inventoryBySlug.get(slug);
    const stock = stockBySlug.get(slug);
    const status = String(product.workflow_status ?? "published");
    const stockStatus = String(inventory?.stock_status ?? "unlinked");
    return {
      id: slug || String(product.name ?? "product"),
      title: String(product.name ?? product.slug ?? "Product"),
      category: String(product.category ?? "Uncategorized"),
      status,
      thumbnailSrc: resolveNextImageSrc(readMediaSrc(product.image) ?? readMediaSrc(product.hero)),
      price: String(product.price ?? "0"),
      compareAt: product.compare_at ? String(product.compare_at) : null,
      badge: product.badge ? String(product.badge) : null,
      description: product.description ? String(product.description) : null,
      onSale: Boolean(product.on_sale),
      discountType: product.discount_type === "percent"
        ? ("percent" as const)
        : product.discount_type === "amount"
          ? ("amount" as const)
          : null,
      discountValue: product.discount_value ? String(product.discount_value) : null,
      costOfGoods: product.cost_of_goods ? String(product.cost_of_goods) : null,
      showPricePerUnit: Boolean(product.show_price_per_unit),
      chargeTax: product.charge_tax !== false,
      taxGroup: product.tax_group ? String(product.tax_group) : "products-default",
      taxRate: product.tax_rate ? String(product.tax_rate) : null,
      taxIncluded: Boolean(product.tax_included),
      stockQuantity: String(stock?.available_quantity ?? inventory?.quantity ?? "0"),
      stockStatus,
      sourceAvailability: String(product.source_availability ?? "catalog"),
      isVisible: Boolean(product.is_visible ?? true),
      updatedAt: product.updated_at ? String(product.updated_at) : null
    };
  });
  const mediaRows = snapshot.data.mediaLinks.slice(0, 12).map((link) => ({
    label: String(link.product_slug ?? link.productSlug ?? "Product slug"),
    value: String(link.media_asset_id ?? link.mediaAssetId ?? "Media asset"),
    detail: `${String(link.usage ?? "gallery")} | primary ${String(Boolean(link.is_primary))}`
  }));
  const variantRows = snapshot.data.products.slice(0, 12).map((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    return {
      label: String(product.slug ?? "Product slug"),
      value: String(variants.length),
      detail: variants.length
        ? variants
            .map((variant: Record<string, unknown>) => String(variant.name ?? variant.id ?? "Variant"))
            .slice(0, 3)
            .join(", ")
        : "No variants"
    };
  });
  const seoRows = snapshot.data.products.slice(0, 12).map((product) => ({
    label: String(product.slug ?? "Product slug"),
    value: String(product.seo_title ?? product.name ?? "SEO title"),
    detail: String(product.seo_description ?? product.tagline ?? "No SEO description")
  }));
  const publishRows = snapshot.data.products.slice(0, 12).map((product) => ({
    label: String(product.slug ?? "Product slug"),
    value: String(product.workflow_status ?? "published"),
    detail: `${String(Boolean(product.is_visible ?? true))} | published ${String(product.published_at ?? "unset")} | archived ${String(product.archived_at ?? "unset")}`
  }));
  const inventoryRows = snapshot.data.inventory.slice(0, 12).map((row) => ({
    label: `${String(row.product_slug ?? "product")}:${String(row.sku ?? "sku")}`,
    value: String(row.quantity ?? 0),
    detail: `${String(row.stock_status ?? "available")} | reserved ${String(row.reserved_quantity ?? 0)} | reorder ${String(row.reorder_threshold ?? 0)}`
  }));

  return (
    <>
      <ModulePanel
        eyebrow="Product command"
        title="Catalog management."
        description={connectivityMessage(snapshot.blockedReason) || "Search products, make quick edits, and open advanced tools only when needed."}
        metrics={[
          { label: "Products", value: String(snapshot.data.products.length) },
          { label: "Media", value: String(snapshot.data.mediaLinks.length) },
          { label: "Low stock", value: String(lowStockCount) }
        ]}
      >
        <div className="grid gap-4">
          <OperationalFeedback
            status={productStatus}
            message={productMessage}
            context="Product update"
            idle="Saved changes and errors appear here."
          />
          <form data-product-search className="grid gap-2 rounded-xl border border-slate-800 bg-[#0b1017] p-2.5 md:grid-cols-[minmax(0,1fr)_168px_auto] md:items-end">
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs font-medium text-slate-400">Search products</span>
              <input name="q" defaultValue={query} placeholder="Name, slug, category" className="h-10 rounded-lg border border-slate-800 bg-[#10151d] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500" />
            </label>
            <label data-product-status-filter className="grid gap-1.5 text-sm">
              <span className="text-xs font-medium text-slate-400">Status</span>
              <select name="workflow_status" defaultValue={statusFilter} className="h-10 rounded-lg border border-slate-800 bg-[#10151d] px-3 text-sm text-slate-100 outline-none focus:border-slate-500">
                <option value="">all</option>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <button className="h-10 rounded-lg border border-slate-700 bg-[#111923] px-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-100 transition-colors hover:border-slate-500 hover:bg-[#151f2b]">Filter</button>
          </form>
          <div data-product-create-toolbar className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0b1017] p-2.5 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                data-product-add-action
                href="/admin/products?tool=create#create-product"
                className={`inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-semibold transition-colors ${activeTool === "create" ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/45 hover:bg-emerald-500/15"}`}
              >
                Add product
              </Link>
              <Link
                data-product-add-category-shortcut
                href="/admin/products?tool=category#product-category"
                className={`inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-semibold transition-colors ${activeTool === "category" ? "border-sky-400/45 bg-sky-500/15 text-sky-100" : "border-slate-700 bg-[#10151d] text-slate-200 hover:border-slate-500 hover:bg-[#151c26]"}`}
              >
                Add category
              </Link>
            </div>
            <nav data-product-tool-dock className="flex flex-wrap items-center gap-2" aria-label="Product tools">
              <span className="font-semibold text-slate-400">Tools</span>
              {productTools.filter((tool) => tool.key !== "create" && tool.key !== "category").map((tool) => (
                <Link
                  key={tool.key}
                  href={tool.href}
                  className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${activeTool === tool.key ? "border-sky-400/45 bg-sky-500/15 text-sky-100" : "border-slate-700 bg-[#10151d] text-slate-300 hover:border-slate-500 hover:bg-[#151c26]"}`}
                >
                  {tool.label}
                </Link>
              ))}
            </nav>
          </div>
          {activeTool === "create" ? (
            <form id="create-product" action={saveProductDraftFormAction} data-product-create-panel data-product-table="mithron_products" className="scroll-mt-24 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm shadow-emerald-950/5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Create product</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">Add a clean catalog item</h2>
                </div>
                <span className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700">Draft first</span>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="grid gap-4">
                  <ProductCreateDetailFields />
                  <div data-product-create-primary-fields className="grid gap-3">
                    <ProductCategoryField
                      categories={categoryOptions}
                      deleteCategoryAction={deleteProductCategoryFormAction}
                    />
                  </div>
                </div>
                <div data-product-create-media-fields className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label data-product-local-image-upload className="grid gap-1.5 text-sm">
                    <span className="text-xs font-medium text-slate-500">Upload image</span>
                    <input
                      name="image_file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:bg-slate-50"
                    />
                  </label>
                  <label data-product-media-picker className="grid gap-1.5 text-sm">
                    <span className="text-xs font-medium text-slate-500">Image URL</span>
                    <input name="image_src" placeholder="Optional if uploading" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-400" />
                  </label>
                </div>
              </div>
              <div data-product-create-submit-bar className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <p data-product-supabase-storage-note className="max-w-3xl text-xs leading-5 text-slate-600">
                  Saves to mithron_products. Uploaded files go to the mithron-products Storage bucket, then link through media_assets and product_media_assets.
                </p>
                <input type="hidden" name="source_availability" value="InStock" />
                <input type="hidden" name="change_summary" value="Add product from admin catalog" />
                <OperationalSubmitButton pendingLabel="Adding" className="h-10 rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
                  Add product
                </OperationalSubmitButton>
              </div>
            </form>
          ) : null}
          {activeTool === "category" ? (
            <form id="product-category" action={saveProductCategoryFormAction} data-product-category-create-panel data-product-table="category_metadata" className="scroll-mt-24 overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm shadow-sky-950/5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-100 bg-sky-50/70 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Create category</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">Add a reusable product category</h2>
                </div>
                <span className="rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-sky-700">Direct add</span>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <label data-product-category-name-input className="grid gap-1.5 text-sm">
                  <span className="text-xs font-medium text-slate-500">Category name</span>
                  <input name="category_title" required placeholder="Example: Payload Systems" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-400" />
                </label>
                <label data-product-category-route-input className="grid gap-1.5 text-sm">
                  <span className="text-xs font-medium text-slate-500">Route key optional</span>
                  <input name="route_key" placeholder="auto-created" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-400" />
                </label>
              </div>
              <div data-product-category-submit-bar className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <p className="max-w-3xl text-xs leading-5 text-slate-600">
                  Creates only the category. No product is saved, and new products can select it after refresh.
                </p>
                <input type="hidden" name="sort_order" value={String(nextCategorySortOrder)} />
                <input type="hidden" name="status" value="published" />
                <input type="hidden" name="is_visible" value="true" />
                <OperationalSubmitButton pendingLabel="Adding category" className="h-10 rounded-lg border border-sky-600 bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700">
                  Add category
                </OperationalSubmitButton>
              </div>
            </form>
          ) : null}
          <ProductCatalogGrid rows={productRows} totalCount={filteredProducts.length} />
        </div>
      </ModulePanel>

      {activeTool === "variants" ? (
      <ModulePanel
        eyebrow="Product setup"
        title="Variants"
        description="Update color, SKU, and image options for the selected product."
      >
        <DataList rows={variantRows.length ? variantRows : [{ label: "Product variants", value: "Unavailable", detail: connectivityMessage(snapshot.blockedReason) || emptyMessage("products") }]} />
        <form id="product-variants" action={saveProductVariantsFormAction} data-product-variants-table="mithron_products" className="mt-8 scroll-mt-24 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Product slug</span>
              <input name="product_slug" defaultValue={activeProductSlug} placeholder="source-agri-kisan-drone-small-8-liter" className={platformFieldClass} />
            </label>
            <div data-product-variant-rows className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
                  <input name="variant_name" placeholder={`Variant ${row} name`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400" />
                  <input name="variant_tone" placeholder="Tone / color" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400" />
                  <input name="variant_sku" placeholder="SKU" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400" />
                  <input name="variant_image_src" placeholder="Variant image URL" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400" />
                </div>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Update product variants" className={platformFieldClass} />
          </label>

          <OperationalSubmitButton pendingLabel="Saving variants">Save product variants</OperationalSubmitButton>
        </form>
      </ModulePanel>
      ) : null}

      {activeTool === "seo" ? (
      <ModulePanel
        eyebrow="Product content"
        title="Search preview"
        description="Edit the title, description, and social preview used for this product."
      >
        <DataList rows={seoRows.length ? seoRows : [{ label: "SEO metadata", value: "Unavailable", detail: connectivityMessage(snapshot.blockedReason) || emptyMessage("products") }]} />
        <form id="product-seo" action={saveProductSeoFormAction} data-product-seo-table="mithron_products" className="mt-8 scroll-mt-24 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Product slug</span>
              <input name="product_slug" defaultValue={activeProductSlug} placeholder="source-agri-kisan-drone-small-8-liter" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">SEO title</span>
              <input name="seo_title" defaultValue="" placeholder="Agri Kisan Drone Small | Mithron Flight Systems" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="text-white/70">SEO description</span>
              <textarea name="seo_description" defaultValue="" rows={3} placeholder="Premium agricultural drone with modular payload delivery." className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">OG title</span>
              <input name="og_title" defaultValue="" placeholder="Agri Kisan Drone Small | Mithron" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">OG description</span>
              <input name="og_description" defaultValue="" placeholder="Cinematic product preview for social sharing." className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="text-white/70">Social image URL</span>
              <input name="og_image_src" defaultValue="" placeholder="https://.../social-preview.webp" className={platformFieldClass} />
            </label>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Update product SEO metadata" className={platformFieldClass} />
          </label>

          <OperationalSubmitButton pendingLabel="Saving SEO">Save product SEO</OperationalSubmitButton>
        </form>
      </ModulePanel>
      ) : null}

      {activeTool === "publish" ? (
      <ModulePanel
        eyebrow="Product control"
        title="Publish state."
        description="Publish, hide, archive, or restore the selected product."
      >
        <DataList rows={publishRows.length ? publishRows : [{ label: "Publication status", value: "Unavailable", detail: connectivityMessage(snapshot.blockedReason) || emptyMessage("products") }]} />
        <div id="archive-product" className="mt-8 scroll-mt-24 grid gap-4">
          <form id="publish-product" action={saveProductPublishStateFormAction} data-product-publish-table="mithron_products" className="grid gap-5 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Archive / restore / publish</p>
                <p className="mt-1 text-xs leading-5 text-white/45">Use archived status as the normal safe delete path.</p>
              </div>
              <StatusBadge status="protected" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="text-white/70">Product slug</span>
                <input name="product_slug" defaultValue="" placeholder="source-agri-kisan-drone-small-8-liter" className={platformFieldClass} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-white/70">Workflow status</span>
                <select name="workflow_status" defaultValue="published" className={platformFieldClass}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input name="is_visible" type="checkbox" defaultChecked className="h-4 w-4 rounded border-[var(--platform-border)] text-teal-700" />
              <span className="text-white/70">Visible in storefront catalog</span>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Change summary</span>
              <input name="change_summary" defaultValue="" placeholder="Set product publication state" className={platformFieldClass} />
            </label>

            <OperationalSubmitButton
              pendingLabel="Saving publish state"
              confirmMessage="Save this product publish, archive, or restore state?"
            >
              Save product publish state
            </OperationalSubmitButton>
          </form>
        </div>
      </ModulePanel>
      ) : null}

      {activeTool === "inventory" ? (
      <ModulePanel
        eyebrow="Product stock"
        title="Inventory"
        description="Connect SKU, warehouse, and stock counts for the selected product."
      >
        <DataList rows={inventoryRows.length ? inventoryRows : [{ label: "inventory", value: "0", detail: "No linked inventory rows yet." }]} />
        <form id="product-inventory" action={saveProductInventoryWorkflowFormAction} data-product-inventory-table="inventory" className="mt-8 scroll-mt-24 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Product slug</span>
              <input name="product_slug" defaultValue="" placeholder="source-agri-kisan-drone-small-8-liter" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">SKU</span>
              <input name="sku" defaultValue="" placeholder="AGRI-8L-BASIC" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Variant ID</span>
              <input name="variant_id" defaultValue="" placeholder="basic-green" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Warehouse code</span>
              <input name="warehouse_code" defaultValue="IN-WEST-01" placeholder="IN-WEST-01" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Stock status</span>
              <select name="stock_status" defaultValue="available" className={platformFieldClass}>
                <option value="available">available</option>
                <option value="low_stock">low_stock</option>
                <option value="out_of_stock">out_of_stock</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Quantity</span>
              <input name="quantity" defaultValue="0" inputMode="numeric" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Reserved quantity</span>
              <input name="reserved_quantity" defaultValue="0" inputMode="numeric" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Reorder threshold</span>
              <input name="reorder_threshold" defaultValue="0" inputMode="numeric" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Warehouse available</span>
              <input name="available_quantity" defaultValue="0" inputMode="numeric" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Warehouse committed</span>
              <input name="committed_quantity" defaultValue="0" inputMode="numeric" className={platformFieldClass} />
            </label>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Sync product inventory linkage" className={platformFieldClass} />
          </label>

          <OperationalSubmitButton pendingLabel="Saving inventory">Save inventory linkage</OperationalSubmitButton>
        </form>
      </ModulePanel>
      ) : null}

      {activeTool === "media" ? (
      <ModulePanel
        eyebrow="Product assets"
        title="Media"
        description="Connect existing media assets to the selected product."
      >
        <DataList rows={mediaRows.length ? mediaRows : [{ label: "Product images", value: "Unavailable", detail: connectivityMessage(snapshot.blockedReason) || emptyMessage("media") }]} />
        <form id="product-media" action={saveProductMediaLinkFormAction} data-product-media-table="product_media_assets" className="mt-8 scroll-mt-24 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Product slug</span>
              <input name="product_slug" defaultValue="" placeholder="source-agri-kisan-drone-small-8-liter" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Media asset ID</span>
              <input name="media_asset_id" defaultValue="" placeholder="media-atlas" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Usage</span>
              <input name="usage" defaultValue="gallery" placeholder="gallery" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Variant ID</span>
              <input name="variant_id" defaultValue="" placeholder="8-liter-green" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Sort order</span>
              <input name="sort_order" defaultValue="0" inputMode="numeric" placeholder="0" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Alt text</span>
              <input name="alt_text" defaultValue="" placeholder="Variant-specific product media alt text" className={platformFieldClass} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Caption</span>
              <input name="caption" defaultValue="" placeholder="Canonical product gallery caption" className={platformFieldClass} />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input name="is_primary" type="checkbox" className="h-4 w-4 rounded border-[var(--platform-border)] text-teal-700" />
            <span className="text-white/70">Primary media asset</span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Link product media row" className={platformFieldClass} />
          </label>

          <OperationalSubmitButton pendingLabel="Saving media link">Save product media link</OperationalSubmitButton>
        </form>
      </ModulePanel>
      ) : null}
    </>
  );
}
