import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { createAuthRouteClient } from "@/lib/server";

type SignupBody = {
  email?: unknown;
  password?: unknown;
  redirectTo?: unknown;
  inviteToken?: unknown;
};

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`auth-signup:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as SignupBody;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken : null;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { supabase } = await createAuthRouteClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo || undefined,
      data: inviteToken ? { invite_token: inviteToken } : undefined
    }
  });

  if (error) {
    // Return generic error to prevent account enumeration
    return NextResponse.json(
      { error: "Unable to create account. Please check your details and try again." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
