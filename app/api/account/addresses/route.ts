import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { listCustomerAddresses } from "@/services/customer-addresses";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const addresses = await listCustomerAddresses(userId);
  return NextResponse.json({ addresses });
}
