import { randomBytes } from "node:crypto";

type EnvSource = Record<string, string | undefined>;

export function generateCspNonce() {
  return randomBytes(16).toString("base64");
}

function resolveSupabaseOrigin(env: EnvSource) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildImageSrcDirective(env: EnvSource) {
  const supabaseOrigin = resolveSupabaseOrigin(env);
  if (env.NODE_ENV !== "production") {
    return ["'self'", "data:", "blob:", "https:", ...(supabaseOrigin ? [supabaseOrigin] : [])].join(" ");
  }

  return [
    "'self'",
    "data:",
    "blob:",
    "https://checkout.razorpay.com",
    "https://sdk.cashfree.com",
    "https://payments.cashfree.com",
    ...(supabaseOrigin ? [supabaseOrigin] : [])
  ].join(" ");
}

export function buildContentSecurityPolicy(nonce: string, env: EnvSource = process.env) {
  const devScriptDirectives = env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : [];
  const devConnectDirectives = env.NODE_ENV !== "production" ? ["ws:", "wss:"] : [];
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...devScriptDirectives,
    "https://checkout.razorpay.com",
    "https://sdk.cashfree.com",
    "https://payments.cashfree.com",
    "https://www.gstatic.com",
    "https://www.google.com",
    "https://apis.google.com"
  ].join(" ");
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "https://accounts.google.com",
    "https://www.googleapis.com",
    "https://www.google.com",
    "https://*.googleapis.com",
    "https://api.razorpay.com",
    "https://api.cashfree.com",
    "https://sandbox.cashfree.com",
    ...devConnectDirectives
  ].join(" ");
  const frameSrc = [
    "https://*.razorpay.com",
    "https://*.cashfree.com",
    "https://www.google.com",
    "https://accounts.google.com"
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `frame-src ${frameSrc}`,
    `connect-src ${connectSrc}`,
    `img-src ${buildImageSrcDirective(env)}`,
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "report-uri /api/csp-report"
  ].join("; ");
}
