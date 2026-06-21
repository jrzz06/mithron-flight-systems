import { assertSupabaseAdminConfig } from "@/lib/env";
import { createAdminRecord, fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { buildValidatedOrderDraft, type CheckoutOrderInput, type OrderCatalogProduct } from "@/services/orders";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

export type EnquiryInput = {
  customerUserId?: string | null;
  customerEmail: string;
  customerPhone: string;
  subject: string;
  body: string;
  relatedProductSlug?: string | null;
  region?: string | null;
};

export async function submitEnquiry(input: EnquiryInput, actorId: string | null, env: EnvSource = process.env) {
  return createAdminRecord(
    "enquiries",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      related_product_slug: input.relatedProductSlug ?? null,
      region: input.region ?? null,
      status: "new",
      payload: { customer_phone: input.customerPhone.trim() }
    },
    actorId,
    env,
    { allowGuest: !actorId }
  );
}

export async function listOwnEnquiries(userId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/enquiries?select=id,subject,body,status,related_product_slug,region,created_at,updated_at&customer_user_id=eq.${userId}&order=created_at.desc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function listAdminEnquiries(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/enquiries?select=id,customer_email,subject,body,status,related_product_slug,assigned_to,converted_order_id,created_at,updated_at&order=created_at.desc&limit=100`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function assignEnquiry(enquiryId: string, assignedTo: string, actorId: string, env: EnvSource = process.env) {
  return updateAdminRecord(
    "enquiries",
    "id",
    enquiryId,
    { assigned_to: assignedTo, status: "contacted", updated_at: new Date().toISOString() },
    actorId,
    env
  );
}

export async function convertEnquiryToOrder(
  enquiryId: string,
  checkoutInput: CheckoutOrderInput,
  catalogProducts: OrderCatalogProduct[],
  actorId: string,
  env: EnvSource = process.env
) {
  const draft = buildValidatedOrderDraft(checkoutInput, catalogProducts);
  const order = await createAdminRecord(
    "orders",
    {
      ...draft.order,
      status: "admin_review",
      metadata: {
        ...draft.order.metadata,
        source_enquiry_id: enquiryId
      }
    },
    actorId,
    env
  );
  const orderId = String(order.id ?? "");
  for (const item of draft.orderItems) {
    await createAdminRecord("order_items", { ...item, order_id: orderId }, actorId, env);
  }
  await updateAdminRecord(
    "enquiries",
    "id",
    enquiryId,
    {
      status: "converted",
      converted_order_id: orderId,
      updated_at: new Date().toISOString()
    },
    actorId,
    env
  );
  return order;
}

export async function getEnquiryById(enquiryId: string, env: EnvSource = process.env) {
  const rows = await fetchAdminRecordsByColumn("enquiries", "id", enquiryId, env);
  return rows[0] ?? null;
}
