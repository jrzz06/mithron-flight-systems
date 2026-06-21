import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { assertSupabaseAdminConfig } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const recipient = url.searchParams.get("recipient");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId || !recipient || recipient !== userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/notifications?select=id,title,body,status,created_at&recipient_id=eq.${userId}&order=created_at.desc&limit=20`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch notifications." }, { status: 500 });
  }

  const notifications = await response.json();
  return NextResponse.json({ notifications });
}
