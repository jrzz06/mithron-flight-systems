import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";
import { resolveSupabaseCookieOptions } from "@/lib/supabase/cookie-config";

export function createClient() {
  const config = getSupabasePublicConfig();
  if (!config.configured) {
    throw new Error(config.message);
  }

  return createBrowserClient(config.url, config.publishableKey, {
    cookieOptions: resolveSupabaseCookieOptions()
  });
}
