import { NextResponse } from "next/server";
import { listPublicPaymentProviders } from "@/services/payments/gateway";

export async function GET() {
  const providers = listPublicPaymentProviders();
  return NextResponse.json({ providers });
}
