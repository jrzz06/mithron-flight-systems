import { NextResponse } from "next/server";
import { parseCheckoutEnquiryRequestBody } from "@/lib/api/checkout-schema";
import { requireClientAuditToken } from "@/lib/api/require-client-audit-token";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { createClient } from "@/lib/server";
import { assertCustomerAddressBelongsToUser } from "@/services/customer-addresses";
import {
  createCustomerCheckoutOrderItemRecord,
  createCustomerCheckoutOrderRecord,
  createNotificationRecord,
  updateAdminRecord
} from "@/services/admin-actions";
import { getCheckoutPricingBySlugs } from "@/services/catalog";
import { buildCustomerEnquiryOrderDraft } from "@/services/orders";
import { formatEnquiryReference, submitCheckoutProductEnquiry } from "@/services/enquiries";
import { resolveCheckoutStockSkus } from "@/services/checkout-stock";

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const body = parseCheckoutEnquiryRequestBody(rawBody);

  if (!body) {
    return NextResponse.json({ error: "Valid email, phone, cart items, and enquiry message are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const rateKey = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`checkout-enquiry:${rateKey}`, 8, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  if (!userId) {
    const audit = requireClientAuditToken(request);
    if (!audit.ok) {
      return NextResponse.json({ error: audit.error }, { status: 401 });
    }
  }

  if (body.addressId && userId) {
    try {
      await assertCustomerAddressBelongsToUser(userId, body.addressId);
    } catch {
      return NextResponse.json({ error: "Invalid shipping address for this account." }, { status: 403 });
    }
  }

  if (body.addressId && !userId) {
    return NextResponse.json({ error: "Sign in to use a saved address, or enter a shipping address below." }, { status: 400 });
  }

  let stockItems;
  try {
    stockItems = await resolveCheckoutStockSkus(body.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve product inventory.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const catalog = await getCheckoutPricingBySlugs(body.items.map((item) => item.productSlug));

  const draft = buildCustomerEnquiryOrderDraft(
    {
      customerEmail: body.email,
      phone: body.phone,
      region: body.region,
      enquiryMessage: body.message,
      items: stockItems.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
        sku: item.sku ?? undefined
      })),
      metadata: {
        shipping_address_id: body.addressId ?? null,
        ...(body.guestAddress ? { guest_shipping_address: body.guestAddress } : {})
      }
    },
    catalog,
    userId
  );

  const orderNumber = `ENQ-PENDING-${crypto.randomUUID().slice(0, 8)}`;
  const order = await createCustomerCheckoutOrderRecord(
    {
      ...draft.order,
      created_by_user_id: userId,
      order_number: orderNumber
    },
    userId
  );

  const orderId = String(order.id ?? "");
  if (!orderId) {
    return NextResponse.json({ error: "Enquiry order creation failed." }, { status: 500 });
  }

  for (const item of draft.orderItems) {
    await createCustomerCheckoutOrderItemRecord({ ...item, order_id: orderId }, userId);
  }

  const productSummary = draft.orderItems
    .map((item) => `${item.product_name} x ${item.quantity}`)
    .join(", ");

  const enquiry = await submitCheckoutProductEnquiry(
    {
      customerUserId: userId,
      customerEmail: body.email,
      customerPhone: body.phone,
      enquiryMessage: body.message,
      orderId,
      orderNumber: String(order.order_number ?? orderNumber),
      region: body.region,
      relatedProductSlug: draft.orderItems[0]?.product_slug ?? null,
      productSummary
    },
    userId
  );

  const enquiryNumber = typeof enquiry.enquiry_number === "number"
    ? enquiry.enquiry_number
    : Number(enquiry.enquiry_number);
  const enquiryReference = formatEnquiryReference(
    Number.isFinite(enquiryNumber) && enquiryNumber > 0 ? enquiryNumber : null
  );
  const linkedOrderNumber = Number.isFinite(enquiryNumber) && enquiryNumber > 0
    ? `ENQ-${enquiryNumber}`
    : String(order.order_number ?? orderNumber);

  if (Number.isFinite(enquiryNumber) && enquiryNumber > 0) {
    await updateAdminRecord("orders", "id", orderId, { order_number: linkedOrderNumber }, userId).catch(() => undefined);
  }

  if (userId) {
    await createNotificationRecord(
      {
        recipient_id: userId,
        channel: "customer",
        title: "Product enquiry received",
        body: "Our team will review your enquiry and contact you shortly.",
        status: "unread",
        entity_table: "orders",
        entity_id: orderId,
        metadata: { recipient_email: body.email, order_type: "enquiry" }
      },
      userId
    );
  }

  return NextResponse.json({
    ok: true,
    orderId,
    orderNumber: linkedOrderNumber,
    enquiryNumber: Number.isFinite(enquiryNumber) && enquiryNumber > 0 ? enquiryNumber : null,
    enquiryReference,
    mode: "enquiry" as const
  });
}
