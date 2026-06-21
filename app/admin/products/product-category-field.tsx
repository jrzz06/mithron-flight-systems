"use client";

import { useId, useMemo, useState } from "react";

export type ProductCategoryOption = {
  label: string;
  routeKey: string | null;
  productCount: number;
  metadataBacked: boolean;
};

type ProductCategoryFieldProps = {
  categories: ProductCategoryOption[];
  deleteCategoryAction: (formData: FormData) => void | Promise<void>;
};

function normalizeCategories(categories: ProductCategoryOption[]) {
  const seen = new Set<string>();
  return categories
    .map((category) => ({
      ...category,
      label: category.label.trim(),
      routeKey: category.routeKey?.trim() || null
    }))
    .filter((category) => category.label)
    .filter((category) => {
      const key = category.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function ProductCategoryField({ categories, deleteCategoryAction }: ProductCategoryFieldProps) {
  const categoryId = useId();
  const options = useMemo(() => normalizeCategories(categories), [categories]);
  const [selectedCategory, setSelectedCategory] = useState(options[0]?.label ?? "");
  const selectedOption = options.find((category) => category.label === selectedCategory) ?? options[0] ?? null;
  const usageLabel = selectedOption
    ? selectedOption.productCount === 1
      ? "1 product uses this"
      : `${selectedOption.productCount} products use this`
    : "No category selected";

  return (
    <div data-product-category-field className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={categoryId} className="text-xs font-medium text-slate-500">
          Category
        </label>
        <button
          type="submit"
          formAction={deleteCategoryAction}
          formNoValidate
          data-product-delete-category-action
          disabled={!selectedOption}
          onClick={(event) => {
            if (!selectedOption) {
              event.preventDefault();
              return;
            }
            const warning = selectedOption.productCount > 0
              ? `Category "${selectedOption.label}" is used by ${selectedOption.productCount} product(s), so deletion will be blocked until those products are moved. Continue?`
              : `Delete category "${selectedOption.label}" from category metadata?`;
            if (!window.confirm(warning)) {
              event.preventDefault();
            }
          }}
          className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Delete
        </button>
      </div>
      <input type="hidden" name="category_route_key" value={selectedOption?.routeKey ?? ""} />
      {options.length ? (
        <select
          id={categoryId}
          name="category"
          required
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-400"
        >
          {options.map((category) => (
            <option key={category.label} value={category.label}>
              {category.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          No existing categories were returned. Add a category first, then return here to create the product.
        </div>
      )}
      {selectedOption ? (
        <p data-product-category-usage className="text-xs leading-5 text-slate-500">
          {usageLabel}. Delete removes the CMS category row only after products are moved out.
        </p>
      ) : null}
    </div>
  );
}
