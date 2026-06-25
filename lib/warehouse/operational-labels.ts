const FULFILLMENT_STEP_LABELS: Record<string, string> = {
  pending: "Waiting",
  processing: "Picking",
  picked: "Packing",
  packed: "Ready for Dispatch",
  ready_to_dispatch: "Ready for Dispatch",
  ready_for_pickup: "Ready for Dispatch",
  shipped: "Dispatched",
  in_transit: "Dispatched",
  delivered: "Completed",
  cancelled: "Cancelled"
};

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Waiting",
  reserved: "Allocated",
  packed: "Packed",
  ready_for_pickup: "Ready for Pickup",
  shipped: "Dispatched",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled"
};

export function fulfillmentStepLabel(status: string) {
  return FULFILLMENT_STEP_LABELS[status] ?? status.replaceAll("_", " ");
}

export function shipmentStatusLabel(status: string) {
  return SHIPMENT_STATUS_LABELS[status] ?? fulfillmentStepLabel(status);
}

export const ORDER_STEP_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Waiting" },
  { value: "processing", label: "Picking" },
  { value: "picked", label: "Packing" },
  { value: "packed", label: "Ready for Dispatch" },
  { value: "ready_to_dispatch", label: "Ready for Dispatch" },
  { value: "shipped", label: "Dispatched" },
  { value: "cancelled", label: "Cancelled" }
] as const;

export function inventoryStatusLabel(status: string, reservedQuantity = 0) {
  if (reservedQuantity > 0 && status === "available") return "Reserved";
  if (status === "available") return "In Stock";
  if (status === "low_stock") return "Low Stock";
  if (status === "out_of_stock") return "Out of Stock";
  if (status === "archived") return "Archived";
  if (status === "discontinued") return "Discontinued";
  if (status === "reserved") return "Reserved";
  return status.replaceAll("_", " ");
}

export const ORDER_STEP_FORM_OPTIONS = [
  { value: "pending", label: "Waiting" },
  { value: "processing", label: "Picking" },
  { value: "picked", label: "Packing" },
  { value: "packed", label: "Ready for Dispatch" },
  { value: "ready_to_dispatch", label: "Ready for Dispatch" },
  { value: "shipped", label: "Dispatched" },
  { value: "cancelled", label: "Cancelled" }
] as const;
