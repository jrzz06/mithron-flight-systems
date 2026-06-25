import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { submitCustomerOrderReview } from "@/services/customer-order-reviews";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to submit a review." }, { status: 401 });
  }

  const formData = await request.formData();
  const orderId = String(formData.get("orderId") ?? "").trim();
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? request.headers.get("idempotency-key") ?? "").trim() || undefined;

  if (!orderId || !productSlug) {
    return NextResponse.json({ error: "orderId and productSlug are required." }, { status: 400 });
  }

  try {
    const record = await submitCustomerOrderReview({
      userId,
      orderId,
      productSlug,
      rating,
      body,
      idempotencyKey: idempotencyKey ? `review:${userId}:${idempotencyKey}` : `review:${userId}:${orderId}:${productSlug}`
    });
    return NextResponse.json({ ok: true, id: record?.id, status: record?.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review submission failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
