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
  await createCustomerAddress(
    userId,
    {
      label: String(formData.get("label") ?? "Home"),
      line1: String(formData.get("line1") ?? ""),
      line2: String(formData.get("line2") ?? "") || null,
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      postalCode: String(formData.get("postal_code") ?? ""),
      country: String(formData.get("country") ?? "India"),
      phone: String(formData.get("phone") ?? "") || null,
      isDefault: formData.get("is_default") === "on"
    },
    userId
  );
  revalidatePath("/account/addresses");
}

export async function deleteAddressFormAction(formData: FormData) {
  const userId = await currentUserId();
  const addressId = String(formData.get("address_id") ?? "");
  await deleteCustomerAddress(userId, addressId, userId);
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
      postalCode: String(formData.get("postal_code") ?? "")
    },
    userId
  );
  revalidatePath("/account/addresses");
}
