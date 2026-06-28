import { isValidCustomerEmail, isValidCustomerPhone } from "@/lib/api/customer-contact";

export type GuestAddress = {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  label?: string;
};

export function isCompleteGuestAddress(address: Partial<GuestAddress> | null | undefined) {
  if (!address) return false;
  const line1 = typeof address.line1 === "string" ? address.line1.trim() : "";
  const city = typeof address.city === "string" ? address.city.trim() : "";
  const region = typeof address.region === "string" ? address.region.trim() : "";
  const postalCode = typeof address.postalCode === "string" ? address.postalCode.trim() : "";
  if (!line1 || !city || !region || !postalCode) return false;
  return ![line1, city, region, postalCode].some((entry) => entry.length > 160);
}

export function isValidCheckoutPhone(phone: string) {
  return isValidCustomerPhone(phone);
}

export function isValidCheckoutEmail(email: string) {
  return isValidCustomerEmail(email);
}

function parseGuestAddressValue(value: unknown): GuestAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const address = value as Record<string, unknown>;
  const line1 = typeof address.line1 === "string" ? address.line1.trim() : "";
  const city = typeof address.city === "string" ? address.city.trim() : "";
  const region = typeof address.region === "string" ? address.region.trim() : "";
  const postalCode = typeof address.postalCode === "string" ? address.postalCode.trim() : "";
  if (!line1 || !city || !region || !postalCode) return null;
  if ([line1, city, region, postalCode].some((entry) => entry.length > 160)) return null;
  const label = typeof address.label === "string" ? address.label.trim().slice(0, 80) : undefined;
  return { line1, city, region, postalCode, ...(label ? { label } : {}) };
}

function parseGuestAddress(record: Record<string, unknown>): GuestAddress | null {
  return parseGuestAddressValue(record.guestAddress);
}

export type CheckoutRequestBody = {
  email: string;
  phone: string;
  fullName: string;
  company?: string;
  items: Array<{ productSlug: string; quantity: number }>;
  addressId?: string;
  billingAddressId?: string;
  guestAddress?: GuestAddress;
  guestBillingAddress?: GuestAddress;
  billingSameAsShipping?: boolean;
  region?: string;
  promoCode?: string;
  paymentProvider?: string;
};

function parseFullName(record: Record<string, unknown>) {
  const fullName = typeof record.fullName === "string" ? record.fullName.trim() : "";
  if (!fullName || fullName.length < 2 || fullName.length > 120) return null;
  return fullName;
}

function parseCompany(record: Record<string, unknown>) {
  const company = typeof record.company === "string" ? record.company.trim() : "";
  if (!company) return undefined;
  if (company.length > 160) return null;
  return company;
}

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
  const quantityBySlug = new Map<string, number>();
  for (const raw of record.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const productSlug = typeof item.productSlug === "string" ? item.productSlug.trim() : "";
    const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
    if (!productSlug || productSlug.length > 200) return null;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) return null;
    quantityBySlug.set(productSlug, (quantityBySlug.get(productSlug) ?? 0) + quantity);
  }

  for (const [productSlug, quantity] of quantityBySlug) {
    if (quantity > 99) return null;
    items.push({ productSlug, quantity });
  }

  const fullName = parseFullName(record);
  if (!fullName) return null;

  const company = parseCompany(record);
  if (company === null) return null;

  const addressId = typeof record.addressId === "string" ? record.addressId.trim() : undefined;
  const billingAddressId = typeof record.billingAddressId === "string" ? record.billingAddressId.trim() : undefined;
  const guestAddress = parseGuestAddress(record);
  const guestBillingAddress = parseGuestAddressValue(record.guestBillingAddress);
  const billingSameAsShipping = record.billingSameAsShipping !== false;
  const region = typeof record.region === "string" ? record.region.trim().slice(0, 120) : undefined;
  const promoCode = typeof record.promoCode === "string" ? record.promoCode.trim().slice(0, 80) : undefined;
  const paymentProvider = typeof record.paymentProvider === "string" ? record.paymentProvider.trim().toLowerCase() : undefined;

  return {
    email,
    phone,
    fullName,
    items,
    ...(company ? { company } : {}),
    ...(addressId ? { addressId } : {}),
    ...(billingAddressId ? { billingAddressId } : {}),
    ...(guestAddress ? { guestAddress } : {}),
    ...(guestBillingAddress ? { guestBillingAddress } : {}),
    billingSameAsShipping,
    ...(region ? { region } : {}),
    ...(promoCode ? { promoCode } : {}),
    ...(paymentProvider ? { paymentProvider } : {})
  };
}

export function validateCheckoutEnquiryRequestBody(body: unknown): { ok: true; data: CheckoutEnquiryRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid enquiry request." };
  }
  const record = body as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim() : "";
  if (!email) return { ok: false, error: "Email is required." };
  if (!isValidCustomerEmail(email)) return { ok: false, error: "Enter a valid email address." };

  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  if (!phone) return { ok: false, error: "Phone number is required." };
  if (!isValidCustomerPhone(phone) || phone.length > 40) {
    return { ok: false, error: "Enter a valid phone number (8–15 digits)." };
  }

  const fullName = typeof record.fullName === "string" ? record.fullName.trim() : "";
  if (!fullName) return { ok: false, error: "Full name is required." };
  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Full name must be between 2 and 120 characters." };
  }

  const company = typeof record.company === "string" ? record.company.trim() : "";
  if (company.length > 160) return { ok: false, error: "Company name is too long." };

  if (!Array.isArray(record.items) || record.items.length === 0) {
    return { ok: false, error: "Add at least one product to your cart before sending an enquiry." };
  }
  if (record.items.length > 50) {
    return { ok: false, error: "Cart is too large for a single enquiry." };
  }

  const message = typeof record.message === "string" ? record.message.trim() : "";
  if (!message) return { ok: false, error: "Add a short message about what you need help with." };
  if (message.length > 5000) return { ok: false, error: "Message is too long." };

  const parsed = parseCheckoutEnquiryRequestBody(body);
  if (!parsed) return { ok: false, error: "Check your contact details and cart, then try again." };
  return { ok: true, data: parsed };
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
