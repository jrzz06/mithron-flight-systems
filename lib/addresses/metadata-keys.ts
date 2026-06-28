/**
 * Canonical order address metadata keys.
 * Immutable address snapshots live in orders.metadata; FK references may also exist on orders.shipping_address_id / billing_address_id.
 */
export const ORDER_ADDRESS_METADATA_KEYS = {
  shippingAddressId: "shipping_address_id",
  billingAddressId: "billing_address_id",
  billingSameAsShipping: "billing_same_as_shipping",
  shippingAddress: "shipping_address",
  billingAddress: "billing_address",
  guestShippingAddress: "guest_shipping_address",
  guestBillingAddress: "guest_billing_address"
} as const;
