export function parseRequestedStockQuantity(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error("Enter the available stock quantity.");
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error("Stock quantity must be a whole number with no decimals.");
  }

  const quantity = Number(raw);
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("Stock quantity must be zero or greater.");
  }

  return quantity;
}
