export function slugifyProductValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveProductSlug(name: string, slugInput = "") {
  const fromInput = slugifyProductValue(slugInput);
  if (fromInput) return fromInput;

  const fromName = slugifyProductValue(name);
  if (fromName) return fromName;

  return `product-${Date.now().toString(36)}`;
}

export function parseProductPrice(value: FormDataEntryValue | null) {
  if (value == null) return Number.NaN;
  const normalized = String(value).replace(/[$,₹\s]/g, "").trim();
  if (!normalized) return Number.NaN;
  const price = Number(normalized);
  return Number.isFinite(price) ? price : Number.NaN;
}

export function parseSupplierProductForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "Agri Drones").trim() || "Agri Drones";
  const slugInput = String(formData.get("slug") ?? "").trim();
  const price = parseProductPrice(formData.get("price"));

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Enter a valid price in INR greater than 0.");
  }

  const slug = resolveProductSlug(name, slugInput);
  return { name, category, price, slug };
}

export type SupplierInventoryInitInput = {
  sku?: string;
  initial_quantity?: number;
  warehouse_code?: string;
  reorder_threshold?: number;
  track_inventory?: boolean;
  stock_notes?: string;
};

function readOptionalInventoryInteger(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseSupplierInventoryInit(formData: FormData): SupplierInventoryInitInput | null {
  const sku = String(formData.get("inventory_sku") ?? "").trim();
  const initialQuantity = readOptionalInventoryInteger(formData, "inventory_initial_quantity") ?? 0;
  const warehouseCode = String(formData.get("inventory_warehouse_code") ?? "").trim();
  const stockNotes = String(formData.get("inventory_stock_notes") ?? "").trim();
  const trackInventory = String(formData.get("inventory_track") ?? "on").trim().toLowerCase() !== "off";

  if (!sku && initialQuantity === 0 && !warehouseCode && !stockNotes) return null;
  if (initialQuantity < 0) {
    throw new Error("Initial quantity cannot be negative.");
  }

  return {
    ...(sku ? { sku } : {}),
    initial_quantity: initialQuantity,
    ...(warehouseCode ? { warehouse_code: warehouseCode } : {}),
    track_inventory: trackInventory,
    ...(stockNotes ? { stock_notes: stockNotes } : {})
  };
}
