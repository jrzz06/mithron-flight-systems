export function normalizeInrAmount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

export function inrToPaise(amountInr: number) {
  const normalized = normalizeInrAmount(amountInr);
  return Math.round(normalized * 100);
}

export function inrAmountsMatch(expected: number, received: number, toleranceInr = 0.01) {
  return Math.abs(normalizeInrAmount(expected) - normalizeInrAmount(received)) <= toleranceInr;
}

export function assertMinimumCheckoutAmount(amountInr: number, providerLabel: string) {
  const normalized = normalizeInrAmount(amountInr);
  if (!Number.isFinite(normalized) || normalized < 1) {
    throw new Error(`Order total must be at least ₹1 for ${providerLabel} checkout.`);
  }
  return normalized;
}
