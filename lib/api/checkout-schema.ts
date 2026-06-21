import { isValidCustomerEmail, isValidCustomerPhone } from "@/lib/api/customer-contact";

export type GuestAddress = {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  label?: string;
};

export function isValidCheckoutPhone(phone: string) {
  return isValidCustomerPhone(phone);
}

export function isValidCheckoutEmail(email: string) {
  return isValidCustomerEmail(email);
}

function parseGuestAddress(record: Record<string, unknown>): GuestAddress | null {
  const guestAddress = record.guestAddress;
  if (!guestAddress || typeof guestAddress !== "object" || Array.isArray(guestAddress)) return null;
  const address = guestAddress as Record<string, unknown>;
  const line1 = typeof address.line1 === "string" ? address.line1.trim() : "";
  const city = typeof address.city === "string" ? address.city.trim() : "";
  const region = typeof address.region === "string" ? address.region.trim() : "";
  const postalCode = typeof address.postalCode === "string" ? address.postalCode.trim() : "";
  if (!line1 || !city || !region || !postalCode) return null;
  if ([line1, city, region, postalCode].some((value) => value.length > 160)) return null;
  const label = typeof address.label === "string" ? address.label.trim().slice(0, 80) : undefined;
  return { line1, city, region, postalCode, ...(label ? { label } : {}) };
}

export type CheckoutRequestBody = {
  email: string;
  phone: string;
  items: Array<{ productSlug: string; quantity: number }>;
  addressId?: string;
  guestAddress?: GuestAddress;
  region?: string;
};

export function parseCheckoutRequestBody(body: unknown): CheckoutRequestBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim() : "";
  if (!isValidCustomerEmail(email)) return null;

  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  if (!isValidCustomerPhone(phone) || phone.length > 40) return null;

  if (!Array.isArray(record.items) || record.items.length === 0 || record.items.length > 50) {
    return null;
  }

  const items: CheckoutRequestBody["items"] = [];
  for (const raw of record.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const productSlug = typeof item.productSlug === "string" ? item.productSlug.trim() : "";
    const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
    if (!productSlug || productSlug.length > 200) return null;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) return null;
    items.push({ productSlug, quantity });
  }

  const addressId = typeof record.addressId === "string" ? record.addressId.trim() : undefined;
  const guestAddress = parseGuestAddress(record);
  const region = typeof record.region === "string" ? record.region.trim().slice(0, 120) : undefined;

  return {
    email,
    phone,
    items,
    ...(addressId ? { addressId } : {}),
    ...(guestAddress ? { guestAddress } : {}),
    ...(region ? { region } : {})
  };
}

export type CheckoutEnquiryRequestBody = CheckoutRequestBody & {
  message: string;
};

export function parseCheckoutEnquiryRequestBody(body: unknown): CheckoutEnquiryRequestBody | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const base = parseCheckoutRequestBody(body);
  if (!base) return null;

  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message || message.length > 5000) return null;

  return {
    ...base,
    message
  };
}
