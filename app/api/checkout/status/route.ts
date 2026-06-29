import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { requireClientAuditToken } from "@/lib/api/require-client-audit-token";
import { createClient } from "@/lib/server";
import { fetchCheckoutOrderStatus } from "@/services/customer-orders";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const orderId = requestUrl.searchParams.get("orderId")?.trim() ?? "";
  const guestEmail = requestUrl.searchParams.get("email")?.trim() ?? "";

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const rateKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`checkout-status:${rateKey}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) {
    const audit = requireClientAuditToken(request);
    if (!audit.ok) {
      return NextResponse.json({ error: audit.error }, { status: 401 });
    }
    if (!guestEmail) {
      return NextResponse.json({ error: "email is required for guest checkout status." }, { status: 400 });
    }
  }

  const status = userId
    ? await fetchCheckoutOrderStatus(orderId, { userId })
    : await fetchCheckoutOrderStatus(orderId, { guestEmail });

  if (!status) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const paid =
    status.paymentStatus === "succeeded" ||
    status.orderPaymentStatus === "succeeded" ||
    status.status === "paid";

  return NextResponse.json({
    ok: true,
    orderId: status.orderId,
    orderNumber: status.orderNumber,
    total: status.total,
    status: status.status,
    paymentStatus: status.paymentStatus,
    orderPaymentStatus: status.orderPaymentStatus,
    paid
  });
}
