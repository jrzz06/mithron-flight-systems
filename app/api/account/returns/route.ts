import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { createReturnRequest } from "@/services/order-returns";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to request a return." }, { status: 401 });
  }

  const formData = await request.formData();
  const orderId = String(formData.get("orderId") ?? "").trim();
  const orderItemId = String(formData.get("orderItemId") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? request.headers.get("idempotency-key") ?? "").trim() || undefined;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  try {
    const record = await createReturnRequest({
      userId,
      orderId,
      orderItemId,
      reason,
      idempotencyKey: idempotencyKey ? `return:${userId}:${idempotencyKey}` : `return:${userId}:${orderId}:${orderItemId ?? "all"}`
    });
    return NextResponse.json({ ok: true, id: record?.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Return request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
