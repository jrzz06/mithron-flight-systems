import {
  deductInventoryForOrder,
  orderInventoryDeducted,
  prepareCheckoutStockItems,
  resolveOrderStockSkus,
  verifyOrderStockAvailability
} from "@/services/inventory";

type EnvSource = Record<string, string | undefined>;

export type CheckoutStockIssue = {
  productSlug: string;
  requested: number;
  available: number;
  warehouseCode: string;
  hasWarehouseRow: boolean;
};

export class CheckoutStockVerificationError extends Error {
  readonly issues: CheckoutStockIssue[];
  readonly warehouseCode: string;

  constructor(issues: CheckoutStockIssue[], warehouseCode: string) {
    const first = issues[0];
    super(
      first
        ? `Insufficient stock for ${first.productSlug}. Requested ${first.requested}, available ${first.available}.`
        : "Insufficient stock for one or more checkout items."
    );
    this.name = "CheckoutStockVerificationError";
    this.issues = issues;
    this.warehouseCode = warehouseCode;
  }
}

export type CheckoutStockItem = {
  productSlug: string;
  quantity: number;
  sku?: string | null;
};

export class CheckoutWarehouseConfigurationError extends Error {
  constructor() {
    super("Checkout warehouse is not configured. Set DEFAULT_WAREHOUSE_CODE or warehouse settings.");
    this.name = "CheckoutWarehouseConfigurationError";
  }
}

export async function resolveCheckoutStockSkus(
  items: Array<{ productSlug: string; quantity: number }>,
  env: EnvSource = process.env
): Promise<CheckoutStockItem[]> {
  return resolveOrderStockSkus(items, env);
}

export async function prepareCheckoutStock(
  items: Array<{ productSlug: string; quantity: number }>,
  env: EnvSource = process.env,
  warehouseCode?: string
): Promise<CheckoutStockItem[]> {
  try {
    return await prepareCheckoutStockItems(items, env);
  } catch (error) {
    const issues = (error as Error & { issues?: Array<{ productSlug: string; requested: number; available: number; hasInventoryRow: boolean }> }).issues ?? [];
    if (!issues.length) throw error;
    throw new CheckoutStockVerificationError(
      issues.map((issue) => ({
        productSlug: issue.productSlug,
        requested: issue.requested,
        available: issue.available,
        warehouseCode: warehouseCode?.trim() || "IN-WEST-01",
        hasWarehouseRow: issue.hasInventoryRow
      })),
      warehouseCode?.trim() || "IN-WEST-01"
    );
  }
}

export async function verifyCheckoutStockAvailability(
  items: Array<{ productSlug: string; quantity: number }>,
  env: EnvSource = process.env,
  warehouseCode?: string
) {
  try {
    await verifyOrderStockAvailability(items, env);
  } catch (error) {
    const issues = (error as Error & { issues?: Array<{ productSlug: string; requested: number; available: number; hasInventoryRow: boolean }> }).issues ?? [];
    if (!issues.length) throw error;
    throw new CheckoutStockVerificationError(
      issues.map((issue) => ({
        productSlug: issue.productSlug,
        requested: issue.requested,
        available: issue.available,
        warehouseCode: warehouseCode?.trim() || "IN-WEST-01",
        hasWarehouseRow: issue.hasInventoryRow
      })),
      warehouseCode?.trim() || "IN-WEST-01"
    );
  }
}

/** @deprecated Reservations removed — checkout is verify-only. */
export async function reserveCheckoutStock(
  _orderId: string,
  _items: CheckoutStockItem[],
  _env: EnvSource = process.env,
  _warehouseCode?: string
) {
  return { skipped: true, rows_reserved: 0 };
}

/** @deprecated Fulfillment deduction uses deductInventoryForOrder on warehouse transition. */
export async function fulfillReservedStock(
  orderId: string,
  actorId: string | null,
  env: EnvSource = process.env,
  warehouseCode?: string
) {
  return deductInventoryForOrder(orderId, actorId, env, warehouseCode);
}

export async function orderHasCheckoutReservations(orderId: string, env: EnvSource = process.env) {
  return orderInventoryDeducted(orderId, env);
}

/** @deprecated Nothing to release — checkout no longer reserves stock. */
export async function releaseCheckoutStock(
  _orderId: string,
  _env: EnvSource = process.env,
  _warehouseCode?: string
) {
  return { skipped: true, rows_released: 0 };
}
