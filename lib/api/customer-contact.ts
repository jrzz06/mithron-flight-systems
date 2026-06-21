/** Shared customer contact validation for checkout, enquiries, and orders. */

export function isValidCustomerEmail(email: string) {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidCustomerPhone(phone: string) {
  const normalized = phone.replace(/[\s\-().]/g, "");
  return /^\+?\d{8,15}$/.test(normalized);
}

export function assertCustomerContact(email: string, phone: string) {
  if (!isValidCustomerEmail(email)) {
    throw new Error("A valid customer email is required.");
  }
  if (!isValidCustomerPhone(phone)) {
    throw new Error("A valid customer phone number is required.");
  }
}

export const CUSTOMER_CONTACT_REQUIRED_MESSAGE = "Email and phone number are required for all customer orders and enquiries.";
