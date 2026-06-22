"use client";

import Link from "next/link";
import Image from "next/image";
import { Copy, Eye, EyeOff, MoreHorizontal, Pencil } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { resolveNextImageSrc } from "@/lib/media/next-image-src";
import {
  saveProductDuplicateFormAction,
  saveProductHardDeleteFormAction,
  saveProductPublishStateFormAction
} from "./actions";
import { ProductDetailEditDialog } from "./product-detail-edit-dialog-loader";

export type ProductCatalogGridRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  thumbnailSrc?: string | null;
  price: string;
  compareAt?: string | null;
  badge?: string | null;
  description?: string | null;
  onSale?: boolean;
  discountType?: "percent" | "amount" | null;
  discountValue?: string | null;
  costOfGoods?: string | null;
  showPricePerUnit?: boolean;
  chargeTax?: boolean;
  taxGroup?: string | null;
  taxRate?: string | null;
  taxIncluded?: boolean;
  stockQuantity: string;
  stockStatus: string;
  sourceAvailability: string;
  isVisible: boolean;
  updatedAt?: string | null;
};

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "published") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-200";
  if (normalized === "archived") return "border-slate-700 bg-slate-900 text-slate-300";
  return "border-amber-400/35 bg-amber-500/10 text-amber-200";
}

function formatCurrency(value: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value || "0";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(numberValue);
}

function ProductImage({ product }: { product: ProductCatalogGridRow }) {
  const thumbnailSrc = resolveNextImageSrc(product.thumbnailSrc);

  return (
    <div className="relative aspect-[7/4] overflow-hidden rounded-lg border border-slate-800 bg-[#f8fafc]">
      {thumbnailSrc ? (
        <Image
          src={thumbnailSrc}
          alt=""
          fill
          sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 768px) 40vw, 90vw"
          loading="lazy"
          className="object-contain p-3.5"
        />
      ) : (
        <div className="grid h-full place-items-center bg-[#0b1017] text-3xl font-semibold text-slate-600">
          {product.title.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function ProductPublishToggle({
  product,
  isLiveOnStorefront,
  onPublishState
}: {
  product: ProductCatalogGridRow;
  isLiveOnStorefront: boolean;
  onPublishState: (id: string, status: string, visible: boolean) => void;
}) {
  const nextStatus = isLiveOnStorefront ? "draft" : "published";
  const label = isLiveOnStorefront ? "Unpublish" : "Publish";
  const Icon = isLiveOnStorefront ? EyeOff : Eye;

  return (
    <form
      action={saveProductPublishStateFormAction}
      data-product-row-action="publish"
      onSubmit={() => onPublishState(product.id, nextStatus, !isLiveOnStorefront)}
      className="min-w-0"
    >
      <input type="hidden" name="product_slug" value={product.id} />
      <input type="hidden" name="workflow_status" value={nextStatus} />
      {isLiveOnStorefront ? null : <input type="hidden" name="is_visible" value="true" />}
      <input type="hidden" name="change_summary" value={`${label} product ${product.id}`} />
      <button
        type="submit"
        title={isLiveOnStorefront ? "Remove product from storefront" : "Publish product to storefront"}
        className={`inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${
          isLiveOnStorefront
            ? "border-slate-700 bg-[#0b1017] text-slate-200 hover:border-slate-500 hover:bg-[#151c26]"
            : "border-emerald-500/35 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

const ProductCard = memo(function ProductCard({
  product,
  menuOpen,
  onMenuToggle,
  onEdit,
  onArchive,
  onPublishState,
  onDelete
}: {
  product: ProductCatalogGridRow;
  menuOpen: boolean;
  onMenuToggle: (id: string) => void;
  onEdit: (product: ProductCatalogGridRow) => void;
  onArchive: (id: string) => void;
  onPublishState: (id: string, status: string, visible: boolean) => void;
  onDelete: (product: ProductCatalogGridRow) => void;
}) {
  const isLiveOnStorefront = product.status === "published" && product.isVisible;

  return (
    <article
      data-product-card
      className={`group relative flex min-h-[260px] flex-col rounded-xl border border-slate-800 bg-[#10151d] p-2.5 shadow-none transition-colors hover:border-slate-600 hover:bg-[#111923] ${menuOpen ? "z-40" : "z-0"}`}
    >
      <ProductImage product={product} />

      <div className="mt-2.5 min-h-[84px] flex-1">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-[11px] font-medium text-slate-400">{product.category}</p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize leading-4 ${statusClass(product.status)}`}>
            {product.status.replaceAll("_", " ")}
          </span>
        </div>
        <h3 className="line-clamp-2 text-[12.5px] font-semibold leading-4 text-slate-100">
          {product.title}
        </h3>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs">
          <div className="rounded-lg border border-slate-800 bg-[#0b1017] px-2.5 py-1.5">
            <p className="text-[11px] text-slate-500">Price</p>
            <p className="mt-0.5 truncate font-semibold text-slate-100">{formatCurrency(product.price)}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0b1017] px-2.5 py-1.5">
            <p className="text-[11px] text-slate-500">Stock</p>
            <p className="mt-0.5 truncate font-semibold text-slate-100">{product.stockQuantity} {product.stockStatus}</p>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid gap-1.5 border-t border-slate-800 pt-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-stretch gap-1.5">
          <button
            type="button"
            data-product-row-action="edit"
            aria-label={`Edit ${product.title}`}
            title="Edit product"
            onClick={() => onEdit(product)}
            className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0b1017] px-2 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-[#151c26]"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Edit
          </button>
          <Link
            data-product-row-action="media"
            href={`/admin/products?product_slug=${encodeURIComponent(product.id)}&tool=media#product-media`}
            className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0b1017] px-2 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-[#151c26]"
          >
            Media
          </Link>
          <div className="relative self-stretch" data-product-row-actions-menu>
            <button
              type="button"
              aria-label={`More actions for ${product.title}`}
              aria-expanded={menuOpen}
              onClick={() => onMenuToggle(product.id)}
              className="grid h-8 w-9 place-items-center rounded-lg border border-slate-700 bg-[#0b1017] text-slate-300 transition-colors hover:border-slate-500 hover:bg-[#151c26]"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.375rem)] z-[90] grid w-44 gap-1 rounded-xl border border-slate-800 bg-[#10151d] p-2 text-xs shadow-lg shadow-black/40">
                <form action={saveProductDuplicateFormAction}>
                  <input type="hidden" name="product_slug" value={product.id} />
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-300 hover:bg-[#151c26] hover:text-slate-100">
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Duplicate
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>

        <ProductPublishToggle
          product={product}
          isLiveOnStorefront={isLiveOnStorefront}
          onPublishState={onPublishState}
        />

        <div className="grid grid-cols-2 items-stretch gap-1.5">
          <form
            action={saveProductPublishStateFormAction}
            data-product-row-action="archive"
            onSubmit={() => onArchive(product.id)}
            className="min-w-0"
          >
            <input type="hidden" name="product_slug" value={product.id} />
            <input type="hidden" name="workflow_status" value="archived" />
            <input type="hidden" name="change_summary" value={`Archive product ${product.id}`} />
            <button
              type="submit"
              title="Archive product"
              className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-400/40 hover:bg-amber-500/15"
            >
              Archive
            </button>
          </form>
          <button
            type="button"
            data-product-row-action="delete"
            title="Delete product"
            onClick={() => onDelete(product)}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-400/40 hover:bg-rose-500/15"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
});

export function ProductCatalogGrid({
  rows,
  totalCount
}: {
  rows: ProductCatalogGridRow[];
  totalCount: number;
}) {
  const [deletedProductIds, setDeletedProductIds] = useState<Set<string>>(() => new Set());
  const [productOverrides, setProductOverrides] = useState<Record<string, Partial<ProductCatalogGridRow>>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductCatalogGridRow | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<ProductCatalogGridRow | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const products = useMemo(
    () => rows
      .filter((product) => !deletedProductIds.has(product.id))
      .map((product) => ({ ...product, ...(productOverrides[product.id] ?? {}) })),
    [deletedProductIds, productOverrides, rows]
  );
  const visibleProducts = useMemo(() => products.slice(0, page * pageSize), [page, products]);
  const adjustedTotalCount = Math.max(totalCount - deletedProductIds.size, products.length);

  function updateProduct(id: string, fields: Partial<ProductCatalogGridRow>) {
    setProductOverrides((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {}),
        ...fields
      }
    }));
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span className="rounded-full border border-slate-800 bg-[#0b1017] px-3 py-1.5">
          Showing {String(visibleProducts.length)} of {String(adjustedTotalCount)} products
        </span>
      </div>
      <div
        id="product-list"
        data-product-operational-grid
        data-product-stock-visibility
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
      >
        {visibleProducts.length ? visibleProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            menuOpen={openMenuId === product.id}
            onMenuToggle={(id) => setOpenMenuId((current) => current === id ? null : id)}
            onEdit={(nextProduct) => {
              setOpenMenuId(null);
              setEditingProduct(nextProduct);
            }}
            onArchive={(id) => {
              setOpenMenuId(null);
              updateProduct(id, { status: "archived", isVisible: false });
            }}
            onPublishState={(id, status, visible) => {
              setOpenMenuId(null);
              updateProduct(id, { status, isVisible: visible });
            }}
            onDelete={(nextProduct) => {
              setOpenMenuId(null);
              setDeleteProduct(nextProduct);
            }}
          />
        )) : (
          <div className="rounded-xl border border-slate-800 bg-[#10151d] p-4 text-sm text-slate-400 md:col-span-2 xl:col-span-4">
            No products match the current filters.
          </div>
        )}
      </div>
      {visibleProducts.length < products.length ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-slate-700 bg-[#10151d] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-[#151c26]"
          >
            Load more products
          </button>
        </div>
      ) : null}

      {editingProduct ? (
        <ProductDetailEditDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(fields) => updateProduct(editingProduct.id, fields)}
        />
      ) : null}

      {deleteProduct ? (
        <div data-product-delete-modal className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <form
            action={saveProductHardDeleteFormAction}
            onSubmit={() => {
              setDeletedProductIds((current) => {
                const next = new Set(current);
                next.add(deleteProduct.id);
                return next;
              });
              setDeleteProduct(null);
            }}
            className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#10151d] p-5 shadow-none"
          >
            <input type="hidden" name="product_slug" value={deleteProduct.id} />
            <input type="hidden" name="confirm_slug" value={deleteProduct.id} />
            <input type="hidden" name="change_summary" value={`Delete product ${deleteProduct.id} from catalog grid`} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-600">Delete product</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">{deleteProduct.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This permanently deletes the product from the database. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteProduct(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-[#151c26]">
                Cancel
              </button>
              <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                Delete product
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
