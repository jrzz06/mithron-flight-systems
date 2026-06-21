// Inline payment gateway check to avoid importing server-only modules
// (prevents bundlers from pulling `node:crypto` into Edge runtime)
function isPaymentGatewayConfigured(env: Record<string, string | undefined> = process.env) {
  const provider = (env.PAYMENT_PROVIDER ?? "stub").toLowerCase();
  if (provider === "stub") {
    return env.NODE_ENV !== "production";
  }
  if (provider === "stripe") {
    return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  }
  if (provider === "razorpay") {
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
  }
  return false;
}

type EnvSource = Record<string, string | undefined>;

export type SupabasePublicConfig =
  | {
      configured: true;
      url: string;
      publishableKey: string;
    }
  | {
      configured: false;
      missing: string[];
      message: string;
    };

export type SupabaseAdminConfig =
  | {
      configured: true;
      url: string;
      publishableKey: string;
      serviceRoleKey: string;
    }
  | {
      configured: false;
      missing: string[];
      message: string;
    };

function getValue(env: EnvSource, key: string) {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function getSupabasePublicConfig(env: EnvSource = process.env): SupabasePublicConfig {
  const url = getValue(env, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = getValue(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? getValue(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const missing = [
    !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    !publishableKey ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : null
  ].filter((item): item is string => Boolean(item));

  if (missing.length || !url || !publishableKey) {
    return {
      configured: false,
      missing,
      message: `Missing Supabase public environment: ${missing.join(", ")}.`
    };
  }

  return { configured: true, url, publishableKey };
}

export function getSupabaseAdminConfig(env: EnvSource = process.env): SupabaseAdminConfig {
  const publicConfig = getSupabasePublicConfig(env);
  const serviceRoleKey = getValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  const missing = [
    ...(!publicConfig.configured ? publicConfig.missing : []),
    !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null
  ].filter((item): item is string => Boolean(item));

  if (!publicConfig.configured || missing.length || !serviceRoleKey) {
    return {
      configured: false,
      missing,
      message: `Missing Supabase admin environment: ${missing.join(", ")}.`
    };
  }

  return {
    configured: true,
    url: publicConfig.url,
    publishableKey: publicConfig.publishableKey,
    serviceRoleKey
  };
}

export function assertSupabaseAdminConfig(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  if (!config.configured) {
    throw new Error(config.message);
  }
  return config;
}

export function assertProductionRuntimeConfig(env: EnvSource = process.env) {
  if (env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (!env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  if (!env.EMAIL_FROM?.trim()) missing.push("EMAIL_FROM");
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.NEXT_PUBLIC_SITE_URL?.trim()) missing.push("NEXT_PUBLIC_SITE_URL");
  if (!env.AUTH_AUDIT_CLIENT_SECRET?.trim()) missing.push("AUTH_AUDIT_CLIENT_SECRET");
  if (!env.PAYMENT_EXPIRE_SECRET?.trim()) missing.push("PAYMENT_EXPIRE_SECRET");

  const paymentProvider = env.PAYMENT_PROVIDER?.trim();
  if (!paymentProvider) {
    missing.push("PAYMENT_PROVIDER");
  } else if (!isPaymentGatewayConfigured(env)) {
    const provider = paymentProvider.toLowerCase();
    if (provider === "razorpay") {
      if (!env.RAZORPAY_KEY_ID?.trim()) missing.push("RAZORPAY_KEY_ID");
      if (!env.RAZORPAY_KEY_SECRET?.trim()) missing.push("RAZORPAY_KEY_SECRET");
      if (!env.RAZORPAY_WEBHOOK_SECRET?.trim()) missing.push("RAZORPAY_WEBHOOK_SECRET");
    } else if (provider === "stripe") {
      if (!env.STRIPE_SECRET_KEY?.trim()) missing.push("STRIPE_SECRET_KEY");
      if (!env.STRIPE_WEBHOOK_SECRET?.trim()) missing.push("STRIPE_WEBHOOK_SECRET");
    } else {
      missing.push(`PAYMENT_PROVIDER credentials for ${provider}`);
    }
  }

  if (!env.UPSTASH_REDIS_REST_URL?.trim() || !env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    missing.push("UPSTASH_REDIS_REST_URL");
    missing.push("UPSTASH_REDIS_REST_TOKEN");
  }

  if (missing.length) {
    throw new Error(`Missing required production environment: ${missing.join(", ")}.`);
  }
}

