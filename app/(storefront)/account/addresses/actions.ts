"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/server";
import { createCustomerAddress, deleteCustomerAddress, updateCustomerAddress } from "@/services/customer-addresses";

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) throw new Error("Authentication required.");
  return userId;
}

export async function createAddressFormAction(formData: FormData) {
  const userId = await currentUserId();
  const billingSameAsShipping = formData.get("billing_same_as_shipping") !== "false";
  const isDefault = formData.get("is_default") === "on";

  const shippingInput = {
    label: String(formData.get("label") ?? "Home"),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? "") || null,
    city: String(formData.get("city") ?? ""),
    region: String(formData.get("region") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    country: String(formData.get("country") ?? "India"),
    phone: String(formData.get("phone") ?? "") || null,
    isDefault,
    isBilling: billingSameAsShipping,
    isShipping: true
  };

  if (!shippingInput.line1.trim() || !shippingInput.city.trim() || !shippingInput.region.trim() || !shippingInput.postalCode.trim()) {
    throw new Error("Enter a complete shipping address.");
  }

  await createCustomerAddress(userId, shippingInput, userId);

  if (!billingSameAsShipping) {
    const billingInput = {
      label: String(formData.get("billing_label") ?? "Billing"),
      line1: String(formData.get("billing_line1") ?? ""),
      line2: String(formData.get("billing_line2") ?? "") || null,
      city: String(formData.get("billing_city") ?? ""),
      region: String(formData.get("billing_region") ?? ""),
      postalCode: String(formData.get("billing_postal_code") ?? ""),
      country: String(formData.get("billing_country") ?? "India"),
      phone: String(formData.get("billing_phone") ?? "") || null,
      isDefault: false,
      isBilling: true,
      isShipping: false
    };

    if (
      !billingInput.line1.trim()
      || !billingInput.city.trim()
      || !billingInput.region.trim()
      || !billingInput.postalCode.trim()
    ) {
      throw new Error("Enter a complete billing address.");
    }

    await createCustomerAddress(userId, billingInput, userId);
  }

  revalidatePath("/account/addresses");
}

export async function deleteAddressFormAction(formData: FormData) {
  const userId = await currentUserId();
  const addressId = String(formData.get("address_id") ?? "");
  await deleteCustomerAddress(userId, addressId, userId);
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressFormAction(formData: FormData) {
  const userId = await currentUserId();
  const addressId = String(formData.get("address_id") ?? "");
  await updateCustomerAddress(userId, addressId, { isDefault: true }, userId);
  revalidatePath("/account/addresses");
}

export async function updateAddressFormAction(formData: FormData) {
  const userId = await currentUserId();
  const addressId = String(formData.get("address_id") ?? "");
  await updateCustomerAddress(
    userId,
    addressId,
    {
      label: String(formData.get("label") ?? ""),
      line1: String(formData.get("line1") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      postalCode: String(formData.get("postal_code") ?? ""),
      isBilling: formData.get("is_billing") === "on",
      isShipping: formData.get("is_shipping") === "on"
    },
    userId
  );
  revalidatePath("/account/addresses");
}
