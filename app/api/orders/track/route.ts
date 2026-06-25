import { NextResponse } from "next/server";
import { lookupOrderForTracking } from "@/services/customer-orders";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const orderNumber = requestUrl.searchParams.get("orderNumber")?.trim() ?? "";
  const email = requestUrl.searchParams.get("email")?.trim() ?? "";

  if (!orderNumber || !email) {
    return NextResponse.json({ error: "orderNumber and email are required." }, { status: 400 });
  }

  const result = await lookupOrderForTracking(orderNumber, email);
  if (!result) {
    return NextResponse.json({ error: "Order not found. Check your order number and email." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    order: result.order,
    items: result.items
  });
}
