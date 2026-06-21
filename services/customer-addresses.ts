import { assertSupabaseAdminConfig } from "@/lib/env";
import { createAdminRecord, deleteAdminRecord, fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

export type CustomerAddressInput = {
  label?: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country?: string;
  phone?: string | null;
  isDefault?: boolean;
  isBilling?: boolean;
  isShipping?: boolean;
};

const customerAddressColumns =
  "id,user_id,label,line1,line2,city,region,postal_code,country,phone,is_default,is_billing,is_shipping,created_at,updated_at";

export async function assertCustomerAddressBelongsToUser(userId: string, addressId: string, env: EnvSource = process.env) {
  const rows = await fetchAdminRecordsByColumn("customer_addresses", "id", addressId, env);
  const row = rows[0];
  if (!row || String(row.user_id ?? "") !== userId) {
    throw new Error("Shipping address not found for this account.");
  }
  return row;
}

export async function listCustomerAddresses(userId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/customer_addresses?select=${customerAddressColumns}&user_id=eq.${userId}&order=is_default.desc,created_at.desc&limit=20`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function createCustomerAddress(userId: string, input: CustomerAddressInput, actorId: string, env: EnvSource = process.env) {
  return createAdminRecord(
    "customer_addresses",
    {
      user_id: userId,
      label: input.label ?? "Home",
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      region: input.region,
      postal_code: input.postalCode,
      country: input.country ?? "India",
      phone: input.phone ?? null,
      is_default: input.isDefault ?? false,
      is_billing: input.isBilling ?? true,
      is_shipping: input.isShipping ?? true
    },
    actorId,
    env
  );
}

export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
  actorId: string,
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("customer_addresses", "id", addressId, env);
  const row = rows[0];
  if (!row || String(row.user_id ?? "") !== userId) {
    throw new Error("Address not found for this customer.");
  }
  return updateAdminRecord(
    "customer_addresses",
    "id",
    addressId,
    {
      ...(input.label ? { label: input.label } : {}),
      ...(input.line1 ? { line1: input.line1 } : {}),
      ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.region ? { region: input.region } : {}),
      ...(input.postalCode ? { postal_code: input.postalCode } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
      ...(input.isBilling !== undefined ? { is_billing: input.isBilling } : {}),
      ...(input.isShipping !== undefined ? { is_shipping: input.isShipping } : {}),
      updated_at: new Date().toISOString()
    },
    actorId,
    env
  );
}

export async function deleteCustomerAddress(userId: string, addressId: string, actorId: string, env: EnvSource = process.env) {
  const rows = await fetchAdminRecordsByColumn("customer_addresses", "id", addressId, env);
  const row = rows[0];
  if (!row || String(row.user_id ?? "") !== userId) {
    throw new Error("Address not found for this customer.");
  }
  return deleteAdminRecord("customer_addresses", "id", addressId, actorId, env);
}
