import { NextResponse } from "next/server";
import { parseEnquiryRequestBody } from "@/lib/api/enquiries-schema";
import { requireClientAuditToken } from "@/lib/api/require-client-audit-token";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { createClient } from "@/lib/server";
import { submitEnquiry } from "@/services/enquiries";
import { createCustomerCheckoutNotificationRecord } from "@/services/admin-actions";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const body = parseEnquiryRequestBody(rawBody);
    if (!body) {
      return NextResponse.json({ error: "Full name, email, phone, subject, and message are required." }, { status: 400 });
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

    if (!userId) {
      const audit = requireClientAuditToken(request);
      if (!audit.ok) {
        return NextResponse.json({ error: audit.error }, { status: 401 });
      }
    }

    const enquiry = await submitEnquiry(
      {
        customerUserId: userId,
        customerEmail: body.email,
        customerPhone: body.phone,
        customerFullName: body.fullName,
        customerCompany: body.company ?? null,
        subject: body.subject,
        body: body.message,
        relatedProductSlug: body.relatedProductSlug ?? null,
        region: body.region ?? null
      },
      userId
    );

    if (userId) {
      await createCustomerCheckoutNotificationRecord({
        recipient_id: userId,
        channel: "customer",
        title: "Enquiry received",
        body: `We received your enquiry: ${body.subject}`,
        status: "unread",
        entity_table: "enquiries",
        entity_id: String(enquiry.id ?? ""),
        metadata: { recipient_email: body.email }
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, enquiryId: enquiry.id ?? null });
  } catch (error) {
    console.error("[enquiries] failed", error);
    const message = error instanceof Error ? error.message : "Could not send enquiry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
