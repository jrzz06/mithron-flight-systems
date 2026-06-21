import { randomBytes } from "node:crypto";

type EnvSource = Record<string, string | undefined>;

export function generateCspNonce() {
  return randomBytes(16).toString("base64");
}

export function buildContentSecurityPolicy(nonce: string, env: EnvSource = process.env) {
  const devScriptDirectives = env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : [];
  const devConnectDirectives = env.NODE_ENV !== "production" ? ["ws:", "wss:"] : [];
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, ...devScriptDirectives, "https://checkout.razorpay.com"].join(" ");
  const connectSrc = ["'self'", "https://*.supabase.co", ...devConnectDirectives].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "frame-src https://*.razorpay.com",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: https: blob:",
    "report-uri /api/csp-report"
  ].join("; ");
}
