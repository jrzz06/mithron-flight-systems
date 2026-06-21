import { cache } from "react";
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import { normalizeCmsRole } from "@/lib/auth/permissions";
import { getSupabaseAdminConfig, type SupabaseAdminConfig } from "@/lib/env";
import { buildEnterpriseCleanupReadiness } from "@/services/enterprise-cleanup";

type EnvSource = Record<string, string | undefined>;
type AdminSnapshotStatus = "LIVE" | "PARTIAL" | "BLOCKED";
type AdminRow = Record<string, unknown>;

type AdminSnapshot<T extends Record<string, unknown>> = {
  status: AdminSnapshotStatus;
  source: "supabase-admin" | "blocked";
  blockedReason?: string;
  data: T;
};

type WarehouseSnapshotScope =
  | "full"
  | "dashboard"
  | "orders"
  | "picking"
  | "packing"
  | "dispatch"
  | "returns"
  | "transfers"
  | "movements"
  | "activity"
  | "settings";

type WarehouseSnapshotTable =
  | "products"
  | "inventory"
  | "stock"
  | "movements"
  | "orders"
  | "orderItems"
  | "shipments"
  | "shipmentItems"
  | "shipmentTimeline"
  | "activityLogs";

type WarehouseSnapshotInput = EnvSource | {
  env?: EnvSource;
  scope?: WarehouseSnapshotScope;
};

type CountMetric = {
  table: string;
  count: number;
  status: "LIVE" | "UNAVAILABLE";
};

const ADMIN_LIST_LIMIT = 80;
const MEDIA_LIBRARY_LIMIT = 96;
const PRODUCT_MANAGER_LIMIT = 120;
const PRODUCT_RELATION_LIMIT = 160;
const MOVEMENT_AUDIT_LIMIT = 80;

const warehouseSnapshotScopes: Record<WarehouseSnapshotScope, Set<WarehouseSnapshotTable>> = {
  full: new Set(["products", "inventory", "stock", "movements", "orders", "orderItems", "shipments", "shipmentItems", "shipmentTimeline", "activityLogs"]),
  dashboard: new Set(["inventory", "stock", "movements", "orders", "shipments"]),
  orders: new Set(["products", "stock", "orders", "orderItems", "shipments"]),
  picking: new Set(["stock", "orders", "orderItems"]),
  packing: new Set(["orders", "orderItems", "shipments"]),
  dispatch: new Set(["shipments", "shipmentItems", "shipmentTimeline"]),
  returns: new Set(["shipments"]),
  transfers: new Set(["stock", "movements"]),
  movements: new Set(["movements"]),
  activity: new Set(["movements", "shipmentTimeline", "activityLogs"]),
  settings: new Set(["inventory", "stock", "shipments"])
};

const dashboardQueries = {
  orders: "select=id,order_number,status,payment_status,fulfillment_status,total,currency,created_at,updated_at&order=created_at.desc&limit=8",
  shipments: "select=id,shipment_number,shipment_status,order_id,warehouse_id,updated_at,created_at&order=updated_at.desc&limit=8",
  inventoryMovements: "select=id,movement_type,product_slug,sku,quantity_delta,created_at&order=created_at.desc&limit=8",
  contentRevisions: "select=id,entity_table,entity_id,revision,change_summary,created_at&order=created_at.desc&limit=8",
  mediaAssets: "select=id,bucket,folder,storage_path,public_url,mime_type,created_at,updated_at&order=created_at.desc&limit=8",
  notifications: "select=id,title,status,created_at,read_at&order=created_at.desc&limit=8",
  activityLogs: "select=id,action,entity_table,entity_id,severity,created_at&order=created_at.desc&limit=8",
  deploymentRequests: "select=id,requester_email,region,mission_profile,status,created_at,updated_at&status=in.(pending,triaged,approved,scheduled,blocked,escalated)&order=updated_at.desc&limit=8",
  staffTasks: "select=id,title,status,priority,assigned_to,due_at,created_at,updated_at&status=in.(open,in_progress,blocked)&order=updated_at.desc&limit=8",
  lowStockInventory: "select=product_slug,sku,stock_status,quantity,reorder_threshold,updated_at&stock_status=in.(low_stock,out_of_stock)&order=updated_at.desc&limit=8"
} as const;

const operationsQueries = {
  operationRoutes: "select=id,route_key,label,href,module_key,required_role,sort_order,is_visible,status&order=sort_order.asc&limit=40",
  deploymentRequests: "select=id,order_id,requester_email,region,mission_profile,status,assigned_to,created_at,updated_at&order=created_at.desc&limit=60",
  staffTasks: "select=id,title,status,priority,assigned_to,due_at,created_at,updated_at&order=created_at.desc&limit=60",
  notifications: "select=id,title,status,priority,entity_table,entity_id,created_at,read_at&order=created_at.desc&limit=60",
  activityLogs: "select=id,action,entity_table,entity_id,severity,created_at&order=created_at.desc&limit=60",
  orders: "select=id,order_number,status,payment_status,fulfillment_status,total,currency,updated_at,created_at&order=updated_at.desc&limit=40",
  shipments: "select=id,shipment_number,shipment_status,status,carrier_name,tracking_number,updated_at,created_at&order=updated_at.desc&limit=40"
} as const;

const auditQueries = {
  auditLogs: "select=id,actor_id,action,entity_table,entity_id,metadata,created_at&order=created_at.desc&limit=60",
  activityLogs: "select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at&order=created_at.desc&limit=60",
  securityEvents: "select=id,actor_user_id,actor_role,event_type,attempted_resource,denial_reason,route_path,http_status,severity,metadata,created_at&order=created_at.desc&limit=80",
  restDenials: "select=id,actor_user_id,actor_role,event_type,attempted_resource,denial_reason,route_path,http_status,severity,metadata,created_at&event_type=in.(security.rest_denied,security.rls_denied,security.denied_mutation)&order=created_at.desc&limit=80",
  realtimeAnomalies: "select=id,actor_user_id,actor_role,event_type,attempted_resource,denial_reason,route_path,http_status,severity,metadata,created_at&event_type=eq.security.realtime_denied&order=created_at.desc&limit=80",
  privilegeEscalations: "select=id,actor_user_id,actor_role,event_type,attempted_resource,denial_reason,route_path,http_status,severity,metadata,created_at&event_type=eq.security.privilege_escalation&order=created_at.desc&limit=80",
  authAnomalies: "select=id,actor_user_id,actor_role,event_type,attempted_resource,denial_reason,route_path,http_status,severity,metadata,created_at&event_type=in.(security.invalid_jwt,security.auth_failed)&order=created_at.desc&limit=80",
  authEvents: "select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at&action=like.auth.%25&order=created_at.desc&limit=80",
  deniedActions: "select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at&action=like.security.%25&order=created_at.desc&limit=80",
  governanceTimeline: "select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at&entity_table=in.(profiles,user_roles,admin_invites)&order=created_at.desc&limit=80",
  productActivity: "select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at&action=like.products.%25&order=created_at.desc&limit=80",
  notifications: "select=id,title,status,priority,entity_table,entity_id,created_at,read_at&order=created_at.desc&limit=80"
} as const;

const governanceQueries = {
  profiles: "select=id,email,display_name,default_role,created_at,updated_at&order=updated_at.desc&limit=160",
  userRoles: "select=user_id,role_key,created_at&order=created_at.desc&limit=320",
  roles: "select=key,label,description,sort_order&order=sort_order.asc&limit=40",
  adminInvites: "select=id,email,role_key,status,expires_at,created_at,updated_at&order=created_at.desc&limit=80",
  activityLogs: "select=id,actor_id,action,entity_table,entity_id,severity,created_at&entity_table=in.(profiles,user_roles,admin_invites)&order=created_at.desc&limit=80"
} as const;

const adminSettingsQueries = {
  settings: "select=id,payload,updated_at&order=updated_at.desc&limit=1",
  mediaUsage: "select=id,mime_type,file_size_bytes,size_bytes,variants,responsive_variants,updated_at&order=updated_at.desc&limit=160"
} as const;

const cmsWorkspaceQueries = {
  cmsPages: "select=id,slug,title,route_path,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  cmsSections: "select=id,page_id,section_key,component_key,title,payload,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  heroBanners: "select=id,product_slug,title,subtitle,cta_label,href,image,poster,video,theme,composition,title_color,subtitle_color,starts_at,ends_at,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  homepageSections: "select=id,section_key,label,component_key,payload,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  sectionVisibility: "select=id,section_key,route_path,is_visible,starts_at,ends_at,status,created_at&order=created_at.desc&limit=20",
  homepageOrdering: "select=section_key,sort_order,is_visible,status,updated_at&order=sort_order.asc&limit=20",
  siteNavigation: "select=id,label,href,placement,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  footerColumns: "select=id,title,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  footerLinks: "select=id,column_id,label,href,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  categoryMetadata: "select=route_key,title,subtitle,hero_image,showcase_image,personality,featured_product_slugs,ecosystem_payload,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  productReviews: "select=id,product_slug,reviewer_name,body,rating,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  faqs: "select=id,question,answer,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  promotionalCampaigns: "select=id,label,headline,body,cta_label,href,media_asset_id,starts_at,ends_at,sort_order,is_visible,status,revision,updated_at,created_at&order=sort_order.asc&limit=20",
  mediaAssets: "select=id,public_url,caption,alt,alt_text,width,height,usage_scope,metadata,updated_at&order=updated_at.desc&limit=40",
  contentRevisions: "select=id,entity_table,entity_id,revision,snapshot,change_summary,created_at&order=created_at.desc&limit=20"
} as const;

type GovernedUser = {
  id: string;
  email: string;
  display_name: string;
  default_role: string;
  roles: string[];
  status: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  email_confirmed_at?: string | null;
};

function blockedSnapshot<T extends Record<string, unknown>>(message: string, data: T): AdminSnapshot<T> {
  return {
    status: "BLOCKED",
    source: "blocked",
    blockedReason: message,
    data
  };
}

function isWarehouseSnapshotScope(value: unknown): value is WarehouseSnapshotScope {
  return typeof value === "string" && value in warehouseSnapshotScopes;
}

function resolveWarehouseSnapshotInput(input: WarehouseSnapshotInput = process.env) {
  const isOptions = Boolean(input && typeof input === "object" && ("scope" in input || "env" in input));
  const options = isOptions ? input as { env?: EnvSource; scope?: unknown } : null;
  const scope = isWarehouseSnapshotScope(options?.scope) ? options.scope : "full";
  return {
    env: options ? (options.env ?? process.env) : (input as EnvSource),
    scope,
    tables: warehouseSnapshotScopes[scope]
  };
}

function getAdminHeaders(config: Extract<SupabaseAdminConfig, { configured: true }>) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function getSupabaseServiceClient(config: Extract<SupabaseAdminConfig, { configured: true }>) {
  return createSupabaseServiceClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function listGovernanceAuthUsers(config: Extract<SupabaseAdminConfig, { configured: true }>) {
  try {
    const supabase = getSupabaseServiceClient(config);
    const authUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (authUsers.error) {
      return { users: [] as SupabaseAuthUser[], error: authUsers.error.message };
    }
    return { users: (authUsers.data?.users ?? []) as SupabaseAuthUser[], error: undefined };
  } catch (error) {
    return {
      users: [] as SupabaseAuthUser[],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchAdminRows<T extends AdminRow>(
  config: Extract<SupabaseAdminConfig, { configured: true }>,
  table: string,
  query = `select=id&limit=${ADMIN_LIST_LIMIT}`
) {
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    headers: getAdminHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      table,
      status: "UNAVAILABLE" as const,
      rows: [] as T[],
      error: `${response.status} ${response.statusText}`
    };
  }

  return {
    table,
    status: "LIVE" as const,
    rows: (await response.json()) as T[]
  };
}

async function countTable(config: Extract<SupabaseAdminConfig, { configured: true }>, table: string): Promise<CountMetric> {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id&limit=1`, {
    method: "HEAD",
    headers: {
      ...getAdminHeaders(config),
      Prefer: "count=exact"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return { table, count: 0, status: "UNAVAILABLE" };
  }

  const range = response.headers.get("content-range");
  const count = range?.includes("/") ? Number(range.split("/").at(-1)) : 0;
  return { table, count: Number.isFinite(count) ? count : 0, status: "LIVE" };
}

async function fetchStorageBuckets(config: Extract<SupabaseAdminConfig, { configured: true }>) {
  const response = await fetch(`${config.url}/storage/v1/bucket`, {
    headers: getAdminHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      table: "storage.buckets",
      status: "UNAVAILABLE" as const,
      rows: [] as AdminRow[],
      error: `${response.status} ${response.statusText}`
    };
  }

  return {
    table: "storage.buckets",
    status: "LIVE" as const,
    rows: (await response.json()) as AdminRow[]
  };
}

function statusFromMetrics(metrics: CountMetric[]): "LIVE" | "PARTIAL" {
  return metrics.every((metric) => metric.status === "LIVE") ? "LIVE" : "PARTIAL";
}

export const getAdminDashboardSnapshot = cache(async (env: EnvSource = process.env) => {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    metrics: [] as CountMetric[],
    recentOrders: [] as AdminRow[],
    recentNotifications: [] as AdminRow[],
    recentActivity: [] as AdminRow[],
    lowStockAlerts: [] as AdminRow[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [metrics, recentOrders, recentNotifications, recentActivity, lowStockAlerts] = await Promise.all([
    Promise.all([
      countTable(config, "orders"),
      countTable(config, "mithron_products"),
      countTable(config, "inventory"),
      countTable(config, "notifications")
    ]),
    fetchAdminRows(config, "orders", dashboardQueries.orders),
    fetchAdminRows(config, "notifications", dashboardQueries.notifications),
    fetchAdminRows(config, "activity_logs", dashboardQueries.activityLogs),
    fetchAdminRows(config, "inventory", dashboardQueries.lowStockInventory)
  ]);
  const rowTables = [recentOrders, recentNotifications, recentActivity, lowStockAlerts];

  return {
    status: statusFromMetrics(metrics) === "LIVE" && rowTables.every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: rowTables.find((table) => table.status !== "LIVE")?.error,
    data: {
      metrics,
      recentOrders: recentOrders.rows,
      recentNotifications: recentNotifications.rows,
      recentActivity: recentActivity.rows,
      lowStockAlerts: lowStockAlerts.rows
    }
  };
});

export const getAuditObservabilitySnapshot = cache(async (env: EnvSource = process.env) => {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    metrics: [] as CountMetric[],
    auditLogs: [] as AdminRow[],
    activityLogs: [] as AdminRow[],
    securityEvents: [] as AdminRow[],
    restDenials: [] as AdminRow[],
    realtimeAnomalies: [] as AdminRow[],
    privilegeEscalations: [] as AdminRow[],
    authAnomalies: [] as AdminRow[],
    authEvents: [] as AdminRow[],
    deniedActions: [] as AdminRow[],
    governanceTimeline: [] as AdminRow[],
    productActivity: [] as AdminRow[],
    notifications: [] as AdminRow[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [
    metrics,
    auditLogs,
    activityLogs,
    securityEvents,
    restDenials,
    realtimeAnomalies,
    privilegeEscalations,
    authAnomalies,
    authEvents,
    deniedActions,
    governanceTimeline,
    productActivity,
    notifications
  ] = await Promise.all([
    Promise.all([
      countTable(config, "audit_logs"),
      countTable(config, "activity_logs"),
      countTable(config, "security_events"),
      countTable(config, "notifications")
    ]),
    fetchAdminRows(config, "audit_logs", auditQueries.auditLogs),
    fetchAdminRows(config, "activity_logs", auditQueries.activityLogs),
    fetchAdminRows(config, "security_events", auditQueries.securityEvents),
    fetchAdminRows(config, "security_events", auditQueries.restDenials),
    fetchAdminRows(config, "security_events", auditQueries.realtimeAnomalies),
    fetchAdminRows(config, "security_events", auditQueries.privilegeEscalations),
    fetchAdminRows(config, "security_events", auditQueries.authAnomalies),
    fetchAdminRows(config, "activity_logs", auditQueries.authEvents),
    fetchAdminRows(config, "activity_logs", auditQueries.deniedActions),
    fetchAdminRows(config, "activity_logs", auditQueries.governanceTimeline),
    fetchAdminRows(config, "activity_logs", auditQueries.productActivity),
    fetchAdminRows(config, "notifications", auditQueries.notifications)
  ]);

  const rowTables = [auditLogs, activityLogs, securityEvents, restDenials, realtimeAnomalies, privilegeEscalations, authAnomalies, authEvents, deniedActions, governanceTimeline, productActivity, notifications];

  return {
    status: metrics.every((metric) => metric.status === "LIVE") && rowTables.every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: rowTables.find((table) => table.status !== "LIVE")?.error,
    data: {
      metrics,
      auditLogs: auditLogs.rows,
      activityLogs: activityLogs.rows,
      securityEvents: securityEvents.rows,
      restDenials: restDenials.rows,
      realtimeAnomalies: realtimeAnomalies.rows,
      privilegeEscalations: privilegeEscalations.rows,
      authAnomalies: authAnomalies.rows,
      authEvents: authEvents.rows,
      deniedActions: deniedActions.rows,
      governanceTimeline: governanceTimeline.rows,
      productActivity: productActivity.rows,
      notifications: notifications.rows
    }
  };
});

export const getEnterpriseCleanupSnapshot = cache(async (env: EnvSource = process.env) => {
  const config = getSupabaseAdminConfig(env);
  const blockedReadiness = buildEnterpriseCleanupReadiness({
    cmsCutoverReady: false,
    cmsParityVerified: false,
    mediaParityVerified: false,
    canonicalMediaRows: 0,
    productMediaLinks: 0,
    realtimeStabilized: false,
    warehouseAuthenticatedVerified: false,
    rollbackRecoveryVerified: false
  });
  const emptyData = {
    readiness: blockedReadiness,
    remoteCounts: [] as CountMetric[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const remoteCounts = await Promise.all([
    countTable(config, "product_reviews"),
    countTable(config, "promotional_campaigns"),
    countTable(config, "section_visibility"),
    countTable(config, "content_revisions"),
    countTable(config, "media_assets"),
    countTable(config, "product_media_assets"),
    countTable(config, "mithron_assets"),
    countTable(config, "inventory"),
    countTable(config, "warehouse_stock"),
    countTable(config, "inventory_movements"),
    countTable(config, "shipments"),
    countTable(config, "shipment_timeline"),
    countTable(config, "notifications"),
    countTable(config, "activity_logs")
  ]);
  const byTable = new Map(remoteCounts.map((metric) => [metric.table, metric]));
  const count = (table: string) => byTable.get(table)?.count ?? 0;
  const live = (table: string) => byTable.get(table)?.status === "LIVE";

  const cmsCutoverReady = count("product_reviews") > 0
    && count("promotional_campaigns") > 0
    && count("section_visibility") > 0
    && count("content_revisions") > 0;
  const realtimeStabilized = live("notifications") && live("activity_logs");
  const warehouseRemoteReady = live("inventory")
    && live("warehouse_stock")
    && live("inventory_movements")
    && live("shipments")
    && live("shipment_timeline");

  const readiness = buildEnterpriseCleanupReadiness({
    cmsCutoverReady,
    cmsParityVerified: false,
    mediaParityVerified: false,
    canonicalMediaRows: count("media_assets"),
    productMediaLinks: count("product_media_assets"),
    realtimeStabilized,
    warehouseAuthenticatedVerified: false,
    rollbackRecoveryVerified: false
  });

  return {
    status: remoteCounts.every((metric) => metric.status === "LIVE") && warehouseRemoteReady ? readiness.status : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: readiness.blockers.join(" "),
    data: { readiness, remoteCounts }
  };
});

export const getUserGovernanceSnapshot = cache(async (env: EnvSource = process.env) => {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    users: [] as GovernedUser[],
    roles: [] as AdminRow[],
    invites: [] as AdminRow[],
    activity: [] as AdminRow[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [authUsers, profiles, userRoles, roles, invites, activity] = await Promise.all([
    listGovernanceAuthUsers(config),
    fetchAdminRows(config, "profiles", governanceQueries.profiles),
    fetchAdminRows(config, "user_roles", governanceQueries.userRoles),
    fetchAdminRows(config, "roles", governanceQueries.roles),
    fetchAdminRows(config, "admin_invites", governanceQueries.adminInvites),
    fetchAdminRows(config, "activity_logs", governanceQueries.activityLogs)
  ]);

  const profileById = new Map(profiles.rows.map((profile) => [String(profile.id ?? ""), profile]));
  const authById = new Map(authUsers.users.map((user) => [user.id, user]));
  const rolesByUser = new Map<string, string[]>();
  for (const row of userRoles.rows) {
    const userId = String(row.user_id ?? "");
    const roleKey = normalizeCmsRole(row.role_key);
    if (!userId || !roleKey) continue;
    const existingRoles = rolesByUser.get(userId) ?? [];
    if (!existingRoles.includes(roleKey)) {
      rolesByUser.set(userId, [...existingRoles, roleKey]);
    }
  }

  const now = Date.now();
  const userIds = new Set([
    ...authUsers.users.map((user) => user.id),
    ...profiles.rows.map((profile) => String(profile.id ?? "")).filter(Boolean)
  ]);
  const users = Array.from(userIds).map((userId) => {
    const user = authById.get(userId);
    const profile = profileById.get(userId);
    const bannedUntil = typeof user?.banned_until === "string" ? user.banned_until : null;
    const isDisabled = bannedUntil ? Date.parse(bannedUntil) > now : false;
    const email = String(user?.email ?? profile?.email ?? "");
    const displayName = String(profile?.display_name ?? user?.user_metadata?.display_name ?? email);
    const roles = rolesByUser.get(userId) ?? [];
    const defaultRole = normalizeCmsRole(profile?.default_role ?? user?.app_metadata?.role) ?? roles[0] ?? "user";

    return {
      id: userId,
      email,
      display_name: displayName,
      default_role: defaultRole,
      roles,
      status: authUsers.error && !user ? "auth_unavailable" : isDisabled ? "disabled" : user?.email_confirmed_at ? "active" : "pending",
      created_at: String(user?.created_at ?? profile?.created_at ?? ""),
      last_sign_in_at: typeof user?.last_sign_in_at === "string" ? user.last_sign_in_at : null,
      banned_until: bannedUntil
    };
  }).sort((first, second) => {
    if (first.status === "disabled" && second.status !== "disabled") return 1;
    if (first.status !== "disabled" && second.status === "disabled") return -1;
    return first.display_name.localeCompare(second.display_name);
  });

  return {
    status: authUsers.error || [profiles, userRoles, roles, invites, activity].some((table) => table.status !== "LIVE") ? "PARTIAL" as const : "LIVE" as const,
    source: "supabase-admin" as const,
    blockedReason: authUsers.error,
    data: {
      users,
      roles: roles.rows,
      invites: invites.rows,
      activity: activity.rows
    }
  };
});

export async function getCmsCoreSnapshot(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  const emptyData = { tables: [] as Array<{ table: string; status: string; rows: AdminRow[] }> };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const tables = await Promise.all([
    fetchAdminRows(config, "cms_pages", cmsWorkspaceQueries.cmsPages),
    fetchAdminRows(config, "cms_sections", cmsWorkspaceQueries.cmsSections),
    fetchAdminRows(config, "hero_banners", cmsWorkspaceQueries.heroBanners),
    fetchAdminRows(config, "product_reviews", cmsWorkspaceQueries.productReviews),
    fetchAdminRows(config, "media_assets", cmsWorkspaceQueries.mediaAssets)
  ]);

  return {
    status: tables.every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: undefined,
    data: { tables }
  };
}

export async function getCmsAdvancedWorkspaceSnapshot(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  const emptyData = { tables: [] as Array<{ table: string; status: string; rows: AdminRow[] }> };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const tables = await Promise.all([
    fetchAdminRows(config, "section_visibility", cmsWorkspaceQueries.sectionVisibility),
    fetchAdminRows(config, "homepage_ordering", cmsWorkspaceQueries.homepageOrdering),
    fetchAdminRows(config, "site_navigation", cmsWorkspaceQueries.siteNavigation),
    fetchAdminRows(config, "footer_columns", cmsWorkspaceQueries.footerColumns),
    fetchAdminRows(config, "footer_links", cmsWorkspaceQueries.footerLinks),
    fetchAdminRows(config, "category_metadata", cmsWorkspaceQueries.categoryMetadata),
    fetchAdminRows(config, "faqs", cmsWorkspaceQueries.faqs),
    fetchAdminRows(config, "content_revisions", cmsWorkspaceQueries.contentRevisions)
  ]);

  return {
    status: tables.every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: undefined,
    data: { tables }
  };
}

function mergeCmsWorkspaceSnapshots(
  core: Awaited<ReturnType<typeof getCmsCoreSnapshot>>,
  advanced: Awaited<ReturnType<typeof getCmsAdvancedWorkspaceSnapshot>>
) {
  if (core.status === "BLOCKED" || advanced.status === "BLOCKED") {
    return {
      status: "BLOCKED" as const,
      source: "blocked" as const,
      blockedReason: core.blockedReason ?? advanced.blockedReason,
      data: {
        tables: [...core.data.tables, ...advanced.data.tables]
      }
    };
  }

  return {
    status: core.status === "LIVE" && advanced.status === "LIVE" ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: core.blockedReason ?? advanced.blockedReason,
    data: {
      tables: [...core.data.tables, ...advanced.data.tables]
    }
  };
}

export async function getCmsWorkspaceSnapshot(env: EnvSource = process.env) {
  const [core, advanced] = await Promise.all([
    getCmsCoreSnapshot(env),
    getCmsAdvancedWorkspaceSnapshot(env)
  ]);
  return mergeCmsWorkspaceSnapshots(core, advanced);
}

export async function getMediaLibrarySnapshot(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    assets: [] as AdminRow[],
    sourceRows: [] as AdminRow[],
    productLinks: [] as AdminRow[],
    buckets: [] as AdminRow[],
    mediaCounts: [] as CountMetric[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [mediaCounts, assets, productLinks, buckets] = await Promise.all([
    Promise.all([
      countTable(config, "media_assets"),
      countTable(config, "mithron_assets"),
      countTable(config, "product_media_assets")
    ]),
    fetchAdminRows(config, "media_assets", `select=id,bucket,folder,storage_path,public_url,mime_type,file_size_bytes,size_bytes,width,height,visibility,status,caption,alt,alt_text,tags,variants,responsive_variants,updated_at&order=updated_at.desc&limit=${MEDIA_LIBRARY_LIMIT}`),
    fetchAdminRows(config, "product_media_assets", `select=product_slug,media_asset_id,usage,variant_id,is_primary,sort_order,alt_text,caption,metadata,updated_at&order=updated_at.desc&limit=${PRODUCT_RELATION_LIMIT}`),
    fetchStorageBuckets(config)
  ]);

  return {
    status: mediaCounts.every((metric) => metric.status === "LIVE") && [assets, productLinks, buckets].every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: undefined,
    data: { assets: assets.rows, sourceRows: [] as AdminRow[], productLinks: productLinks.rows, buckets: buckets.rows, mediaCounts }
  };
}

export async function getAdminSettingsSnapshot(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    settings: {} as AdminRow,
    storage: {
      usageBytes: 0,
      mediaCount: 0,
      optimizedImagesCount: 0,
      cdnCacheStatus: "No media"
    },
    mediaCounts: [] as CountMetric[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [settings, mediaCounts, mediaUsage] = await Promise.all([
    fetchAdminRows(config, "admin_settings", adminSettingsQueries.settings),
    Promise.all([
      countTable(config, "media_assets"),
      countTable(config, "product_media_assets")
    ]),
    fetchAdminRows(config, "media_assets", adminSettingsQueries.mediaUsage)
  ]);
  const usageBytes = mediaUsage.rows.reduce((total, row) => total + Number(row.file_size_bytes ?? row.size_bytes ?? 0), 0);
  const optimizedImagesCount = mediaUsage.rows.filter((row) => {
    const mimeType = String(row.mime_type ?? "");
    return mimeType.includes("avif") || mimeType.includes("webp") || Boolean(row.variants) || Boolean(row.responsive_variants);
  }).length;
  const settingsPayload = settings.rows[0]?.payload;

  return {
    status: settings.status === "LIVE" && mediaUsage.status === "LIVE" && mediaCounts.every((metric) => metric.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: settings.status !== "LIVE" ? settings.error : mediaUsage.status !== "LIVE" ? mediaUsage.error : undefined,
    data: {
      settings: settingsPayload && typeof settingsPayload === "object" && !Array.isArray(settingsPayload) ? settingsPayload as AdminRow : {},
      storage: {
        usageBytes: Number.isFinite(usageBytes) ? usageBytes : 0,
        mediaCount: mediaCounts.find((metric) => metric.table === "media_assets")?.count ?? mediaUsage.rows.length,
        optimizedImagesCount,
        cdnCacheStatus: mediaUsage.rows.length ? "Ready" : "No media"
      },
      mediaCounts
    }
  };
}

export async function getProductManagerSnapshot(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    products: [] as AdminRow[],
    mediaLinks: [] as AdminRow[],
    inventory: [] as AdminRow[],
    stock: [] as AdminRow[],
    movements: [] as AdminRow[],
    categories: [] as AdminRow[],
    productCounts: [] as CountMetric[],
    mediaCounts: [] as CountMetric[],
    stockCoverage: { productCount: 0, inventoryLinked: 0, stockLinked: 0, missingStock: 0 }
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [productCounts, mediaCounts, products, mediaLinks, inventory, stock, movements, categories] = await Promise.all([
    Promise.all([
      countTable(config, "mithron_products"),
      countTable(config, "inventory"),
      countTable(config, "warehouse_stock")
    ]),
    Promise.all([
      countTable(config, "media_assets"),
      countTable(config, "product_media_assets")
    ]),
    fetchAdminRows(config, "mithron_products", `select=slug,name,category,price,image,hero,variants,workflow_status,published_at,archived_at,is_visible,seo_title,seo_description,og_title,og_description,og_image,source_availability,sort_order,updated_at&order=sort_order.asc&limit=${PRODUCT_MANAGER_LIMIT}`),
    fetchAdminRows(config, "product_media_assets", `select=product_slug,media_asset_id,usage,variant_id,is_primary,sort_order,alt_text,caption,metadata,updated_at&order=updated_at.desc&limit=${PRODUCT_RELATION_LIMIT}`),
    fetchAdminRows(config, "inventory", `select=product_slug,sku,stock_status,quantity,reserved_quantity,reorder_threshold,updated_at&order=updated_at.desc&limit=${PRODUCT_RELATION_LIMIT}`),
    fetchAdminRows(config, "warehouse_stock", `select=warehouse_code,product_slug,sku,available_quantity,committed_quantity,last_counted_at,updated_at&order=updated_at.desc&limit=${PRODUCT_RELATION_LIMIT}`),
    fetchAdminRows(config, "inventory_movements", `select=id,movement_type,product_slug,sku,quantity_before,quantity_after,quantity_delta,reason_code,actor_user_id,related_order_id,related_shipment_id,created_at&order=created_at.desc&limit=${MOVEMENT_AUDIT_LIMIT}`),
    fetchAdminRows(config, "category_metadata", "select=route_key,title,status,is_visible,sort_order&order=sort_order.asc&limit=80")
  ]);
  const inventorySlugs = new Set(inventory.rows.map((row) => String(row.product_slug ?? "")).filter(Boolean));
  const stockSlugs = new Set(stock.rows.map((row) => String(row.product_slug ?? "")).filter(Boolean));
  const stockCoverage = {
    productCount: products.rows.length,
    inventoryLinked: products.rows.filter((product) => inventorySlugs.has(String(product.slug ?? ""))).length,
    stockLinked: products.rows.filter((product) => stockSlugs.has(String(product.slug ?? ""))).length,
    missingStock: products.rows.filter((product) => !stockSlugs.has(String(product.slug ?? ""))).length
  };

  return {
    status: [...productCounts, ...mediaCounts].every((metric) => metric.status === "LIVE") && [products, mediaLinks, inventory, stock, movements, categories].every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: undefined,
    data: { products: products.rows, mediaLinks: mediaLinks.rows, inventory: inventory.rows, stock: stock.rows, movements: movements.rows, categories: categories.rows, productCounts, mediaCounts, stockCoverage }
  };
}

export const getWarehouseSnapshot = cache(async (input: WarehouseSnapshotInput = process.env) => {
  const { env: resolvedEnv, tables } = resolveWarehouseSnapshotInput(input);
  const config = getSupabaseAdminConfig(resolvedEnv);

  const emptyData = {
    products: [] as AdminRow[],
    inventory: [] as AdminRow[],
    stock: [] as AdminRow[],
    movements: [] as AdminRow[],
    orders: [] as AdminRow[],
    orderItems: [] as AdminRow[],
    shipments: [] as AdminRow[],
    shipmentItems: [] as AdminRow[],
    shipmentTimeline: [] as AdminRow[],
    activityLogs: [] as AdminRow[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const skipped = <T extends AdminRow>(table: string) => ({
    table,
    status: "SKIPPED" as const,
    rows: [] as T[]
  });
  const maybeFetch = <T extends AdminRow>(key: WarehouseSnapshotTable, table: string, query: string) => (
    tables.has(key)
      ? fetchAdminRows<T>(config, table, query)
      : Promise.resolve(skipped<T>(table))
  );

  const [products, inventory, stock, movements, orders, orderItems, shipments, shipmentItems, shipmentTimeline, activityLogs] = await Promise.all([
    maybeFetch("products", "mithron_products", "select=slug,name,category,price,image,hero,workflow_status,archived_at,is_visible,updated_at&order=sort_order.asc&limit=80"),
    maybeFetch("inventory", "inventory", "select=product_slug,sku,variant_id,stock_status,quantity,reserved_quantity,reorder_threshold,updated_at&order=updated_at.desc&limit=120"),
    maybeFetch("stock", "warehouse_stock", "select=id,warehouse_code,product_slug,sku,variant_id,available_quantity,committed_quantity,last_counted_at,updated_at&order=updated_at.desc&limit=120"),
    maybeFetch("movements", "inventory_movements", "select=id,movement_type,product_slug,sku,quantity_before,quantity_after,quantity_delta,reason_code,actor_user_id,related_order_id,related_shipment_id,created_at&order=created_at.desc&limit=80"),
    maybeFetch("orders", "orders", "select=id,order_number,customer_email,status,payment_status,fulfillment_status,total,currency,items,timeline,created_at,updated_at&order=created_at.desc&limit=80"),
    maybeFetch("orderItems", "order_items", "select=id,order_id,product_slug,product_name,sku,quantity,line_total,metadata,created_at&order=created_at.desc&limit=120"),
    maybeFetch("shipments", "shipments", "select=id,shipment_number,shipment_status,order_id,warehouse_id,carrier_name,tracking_number,updated_at,created_at&order=updated_at.desc&limit=80"),
    maybeFetch("shipmentItems", "shipment_items", "select=id,shipment_id,order_item_id,product_id,variant_id,quantity,created_at&order=created_at.desc&limit=120"),
    maybeFetch("shipmentTimeline", "shipment_timeline", "select=id,shipment_id,event_type,previous_status,next_status,actor_user_id,created_at&order=created_at.desc&limit=80"),
    maybeFetch("activityLogs", "activity_logs", "select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at&entity_table=in.(orders,shipments,inventory,warehouse_stock,inventory_movements)&order=created_at.desc&limit=80")
  ]);
  const fetchedTables = [products, inventory, stock, movements, orders, orderItems, shipments, shipmentItems, shipmentTimeline, activityLogs]
    .filter((table) => table.status !== "SKIPPED");
  const blockedTable = fetchedTables.find((table) => table.status !== "LIVE");

  return {
    status: fetchedTables.every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: blockedTable?.error,
    data: {
      products: products.rows,
      inventory: inventory.rows,
      stock: stock.rows,
      movements: movements.rows,
      orders: orders.rows,
      orderItems: orderItems.rows,
      shipments: shipments.rows,
      shipmentItems: shipmentItems.rows,
      shipmentTimeline: shipmentTimeline.rows,
      activityLogs: activityLogs.rows
    }
  };
});

export async function getOperationsSnapshot(env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  const emptyData = {
    routes: [] as AdminRow[],
    requests: [] as AdminRow[],
    tasks: [] as AdminRow[],
    notifications: [] as AdminRow[],
    activity: [] as AdminRow[],
    orders: [] as AdminRow[],
    shipments: [] as AdminRow[]
  };
  if (!config.configured) return blockedSnapshot(config.message, emptyData);

  const [routes, requests, tasks, notifications, activity, orders, shipments] = await Promise.all([
    fetchAdminRows(config, "operation_routes", operationsQueries.operationRoutes),
    fetchAdminRows(config, "deployment_requests", operationsQueries.deploymentRequests),
    fetchAdminRows(config, "staff_tasks", operationsQueries.staffTasks),
    fetchAdminRows(config, "notifications", operationsQueries.notifications),
    fetchAdminRows(config, "activity_logs", operationsQueries.activityLogs),
    fetchAdminRows(config, "orders", operationsQueries.orders),
    fetchAdminRows(config, "shipments", operationsQueries.shipments)
  ]);

  return {
    status: [routes, requests, tasks, notifications, activity, orders, shipments].every((table) => table.status === "LIVE") ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: undefined,
    data: {
      routes: routes.rows,
      requests: requests.rows,
      tasks: tasks.rows,
      notifications: notifications.rows,
      activity: activity.rows,
      orders: orders.rows,
      shipments: shipments.rows
    }
  };
}
