import { cache } from "react";
import { assertSupabaseAdminConfig } from "@/lib/env";

type EnvSource = Record<string, string | undefined>;
type JsonRecord = Record<string, unknown>;

function readSection(payload: JsonRecord, key: string) {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function enabled(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

async function loadAdminSettingsPayload(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/admin_settings?id=eq.global&select=payload&limit=1`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return {} as JsonRecord;
  const rows = (await response.json()) as Array<{ payload?: JsonRecord }>;
  const payload = rows[0]?.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

export type AdminSettingsPolicy = {
  warehouseAlertsEnabled: boolean;
  orderAlertsEnabled: boolean;
  cmsPublishAlertsEnabled: boolean;
  adminLoginAlertsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  realtimeUpdatesEnabled: boolean;
  draftModeEnabled: boolean;
  instantPublishEnabled: boolean;
  sectionVisibilityControlsEnabled: boolean;
  queryCachingEnabled: boolean;
  lowBandwidthModeEnabled: boolean;
  defaultWarehouseCode: string;
  sessionTimeoutMinutes: number;
  passwordResetEnabled: boolean;
  allowedAdminDomains: string[];
};

export function assertAdminEmailDomainAllowed(email: string, policy: AdminSettingsPolicy) {
  if (!policy.allowedAdminDomains.length) return;
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  if (!domain || !policy.allowedAdminDomains.includes(domain)) {
    throw new Error(`Email domain "${domain || "unknown"}" is not allowed for admin-managed accounts.`);
  }
}

export function assertPasswordResetPolicyAllowed(policy: AdminSettingsPolicy) {
  if (!policy.passwordResetEnabled) {
    throw new Error("Password reset is disabled in admin security settings.");
  }
}

export function assertCmsPublishPolicyAllowed(policy: AdminSettingsPolicy) {
  if (!policy.draftModeEnabled && !policy.instantPublishEnabled) {
    throw new Error("CMS publishing is disabled. Enable draft mode or instant publish in admin settings.");
  }
}

export function assertSectionVisibilityPolicyAllowed(policy: AdminSettingsPolicy) {
  if (!policy.sectionVisibilityControlsEnabled) {
    throw new Error("Section visibility controls are disabled in admin CMS settings.");
  }
}

export const getAdminSettingsPolicy = cache(async (env: EnvSource = process.env): Promise<AdminSettingsPolicy> => {
  const payload = await loadAdminSettingsPayload(env);
  const notifications = readSection(payload, "notifications");
  const performance = readSection(payload, "performance");
  const cms = readSection(payload, "cms");
  const security = readSection(payload, "security");
  const domains = String(security.allowed_admin_domains ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const warehouse = readSection(payload, "warehouse");
  const warehouseConfig = await import("@/services/warehouse-config").then((module) => module.getWarehouseConfiguration(env));
  const configuredDefault = String(warehouse.default_warehouse_code ?? "").trim();

  return {
    warehouseAlertsEnabled: enabled(notifications.warehouse_alerts, true),
    orderAlertsEnabled: enabled(notifications.order_alerts, true),
    cmsPublishAlertsEnabled: enabled(notifications.cms_publish_alerts, true),
    adminLoginAlertsEnabled: enabled(notifications.admin_login_alerts, true),
    emailNotificationsEnabled: enabled(notifications.email_notifications, false),
    realtimeUpdatesEnabled: enabled(performance.realtime_updates, true),
    draftModeEnabled: enabled(cms.draft_mode, true),
    instantPublishEnabled: enabled(cms.instant_publish, false),
    sectionVisibilityControlsEnabled: enabled(cms.section_visibility_controls, true),
    queryCachingEnabled: enabled(performance.query_caching, true),
    lowBandwidthModeEnabled: enabled(performance.low_bandwidth_mode, false),
    defaultWarehouseCode: configuredDefault || warehouseConfig.defaultWarehouseCode,
    sessionTimeoutMinutes: Number(security.session_timeout_minutes ?? 60) || 60,
    passwordResetEnabled: enabled(security.password_reset_enabled, true),
    allowedAdminDomains: domains
  };
});
