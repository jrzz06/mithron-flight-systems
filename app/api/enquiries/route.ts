import { NextResponse } from "next/server";
import { parseEnquiryRequestBody } from "@/lib/api/enquiries-schema";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { createClient } from "@/lib/server";
import { submitEnquiry } from "@/services/enquiries";
import { createNotificationRecord } from "@/services/admin-actions";

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const body = parseEnquiryRequestBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Email, phone, subject, and message are required." }, { status: 400 });
  }
  if (!body.subject && !body.message && !body.email) {
    return NextResponse.json({ ok: true, enquiryId: null });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const rateKey = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`enquiries:${rateKey}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const enquiry = await submitEnquiry(
    {
      customerUserId: userId,
      customerEmail: body.email,
      customerPhone: body.phone,
      subject: body.subject,
      body: body.message,
      relatedProductSlug: body.relatedProductSlug ?? null,
      region: body.region ?? null
    },
    userId
  );

  if (userId) {
    await createNotificationRecord(
      {
        recipient_id: userId,
        channel: "customer",
        title: "Enquiry received",
        body: `We received your enquiry: ${body.subject}`,
        status: "unread",
        entity_table: "enquiries",
        entity_id: String(enquiry.id ?? ""),
        metadata: { recipient_email: body.email }
      },
      userId
    ).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, enquiryId: enquiry.id ?? null });
}
