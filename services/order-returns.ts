import { assertSupabaseAdminConfig } from "@/lib/env";
import { canTransition } from "@/lib/workflows/registry";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

async function insertActivity(
  actorId: string | null,
  action: string,
  entityTable: string,
  entityId: string,
  metadata: JsonRecord,
  env: EnvSource
) {
  const config = assertSupabaseAdminConfig(env);
  await fetch(`${config.url}/rest/v1/activity_logs`, {
    method: "POST",
    headers: headers(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({
      actor_id: actorId,
      action,
      entity_table: entityTable,
      entity_id: entityId,
      severity: "info",
      metadata
    })
  });
}

async function notifyAdmins(title: string, body: string, entityTable: string, entityId: string, env: EnvSource) {
  const config = assertSupabaseAdminConfig(env);
  const adminResponse = await fetch(
    `${config.url}/rest/v1/user_roles?select=user_id&role_key=eq.admin&limit=20`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!adminResponse.ok) return;
  const admins = (await adminResponse.json()) as Array<{ user_id?: string }>;
  const now = new Date().toISOString();
  for (const admin of admins) {
    const recipientId = String(admin.user_id ?? "");
    if (!recipientId) continue;
    await fetch(`${config.url}/rest/v1/notifications`, {
      method: "POST",
      headers: headers(config.serviceRoleKey, "return=minimal"),
      body: JSON.stringify({
        recipient_id: recipientId,
        channel: "in_app",
        title,
        body,
        status: "unread",
        priority: "normal",
        entity_table: entityTable,
        entity_id: entityId,
        created_at: now
      })
    });
  }
}

async function notifyUser(
  recipientId: string,
  title: string,
  body: string,
  entityTable: string,
  entityId: string,
  env: EnvSource
) {
  const config = assertSupabaseAdminConfig(env);
  await fetch(`${config.url}/rest/v1/notifications`, {
    method: "POST",
    headers: headers(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({
      recipient_id: recipientId,
      channel: "in_app",
      title,
      body,
      status: "unread",
      priority: "normal",
      entity_table: entityTable,
      entity_id: entityId,
      created_at: new Date().toISOString()
    })
  });
}

export async function listReturnRequestsForOrder(orderId: string, userId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/order_return_requests?select=id,order_id,order_item_id,reason,status,admin_note,created_at,updated_at&order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function listPendingReturnRequests(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/order_return_requests?select=id,order_id,user_id,order_item_id,reason,status,created_at&status=in.(requested,approved)&order=created_at.asc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function createReturnRequest(
  input: {
    userId: string;
    orderId: string;
    orderItemId?: string | null;
    reason: string;
    idempotencyKey?: string;
  },
  env: EnvSource = process.env
) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A return reason is required.");

  const config = assertSupabaseAdminConfig(env);
  const orderResponse = await fetch(
    `${config.url}/rest/v1/orders?select=id,status,fulfillment_status,created_by_user_id&id=eq.${encodeURIComponent(input.orderId)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!orderResponse.ok) throw new Error("Could not verify order.");
  const orders = (await orderResponse.json()) as JsonRecord[];
  const order = orders[0];
  if (!order || String(order.created_by_user_id ?? "") !== input.userId) {
    throw new Error("Order not found.");
  }

  const fulfillment = String(order.fulfillment_status ?? "");
  const status = String(order.status ?? "");
  if (fulfillment !== "delivered" && status !== "delivered") {
    throw new Error("Returns are only available after delivery.");
  }

  const payload: JsonRecord = {
    order_id: input.orderId,
    user_id: input.userId,
    order_item_id: input.orderItemId ?? null,
    reason,
    status: "requested",
    updated_at: new Date().toISOString()
  };
  if (input.idempotencyKey) payload.idempotency_key = input.idempotencyKey;

  const response = await fetch(`${config.url}/rest/v1/order_return_requests`, {
    method: "POST",
    headers: headers(config.serviceRoleKey, "return=representation,resolution=ignore-duplicates"),
    body: JSON.stringify(payload)
  });

  if (response.status === 409 || response.status === 23505) {
    const existing = await listReturnRequestsForOrder(input.orderId, input.userId, env);
    const match = existing.find((row) => row.status === "requested" || row.status === "approved");
    if (match) return match;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Return request failed: ${response.status}${text ? ` - ${text.slice(0, 160)}` : ""}`);
  }

  const [record] = (await response.json()) as JsonRecord[];
  const id = String(record?.id ?? "");
  await insertActivity(input.userId, "return.requested", "order_return_requests", id, { order_id: input.orderId }, env);
  await notifyAdmins("Return requested", `Order return submitted for order ${input.orderId}.`, "order_return_requests", id, env);
  return record;
}

export async function updateReturnRequestStatus(
  input: {
    requestId: string;
    fromStatus: string;
    toStatus: string;
    actorId: string;
    actorRole: "warehouse" | "admin" | "user";
    adminNote?: string;
  },
  env: EnvSource = process.env
) {
  if (!canTransition("return_request", input.fromStatus, input.toStatus, input.actorRole)) {
    throw new Error(`Cannot transition return from ${input.fromStatus} to ${input.toStatus}.`);
  }

  const config = assertSupabaseAdminConfig(env);
  const currentResponse = await fetch(
    `${config.url}/rest/v1/order_return_requests?select=id,order_id,user_id,status&id=eq.${encodeURIComponent(input.requestId)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!currentResponse.ok) throw new Error("Return request not found.");
  const rows = (await currentResponse.json()) as JsonRecord[];
  const current = rows[0];
  if (!current || String(current.status ?? "") !== input.fromStatus) {
    throw new Error("Return request status changed. Refresh and retry.");
  }

  const patch: JsonRecord = {
    status: input.toStatus,
    updated_at: new Date().toISOString()
  };
  if (input.adminNote) patch.admin_note = input.adminNote;

  const response = await fetch(
    `${config.url}/rest/v1/order_return_requests?id=eq.${encodeURIComponent(input.requestId)}&status=eq.${encodeURIComponent(input.fromStatus)}`,
    {
      method: "PATCH",
      headers: headers(config.serviceRoleKey, "return=representation"),
      body: JSON.stringify(patch)
    }
  );

  if (!response.ok) throw new Error("Failed to update return request.");
  const [record] = (await response.json()) as JsonRecord[];
  if (!record) throw new Error("Return request was updated by another process.");

  await insertActivity(
    input.actorId,
    `return.${input.toStatus}`,
    "order_return_requests",
    input.requestId,
    { from: input.fromStatus, to: input.toStatus },
    env
  );

  const userId = String(current.user_id ?? "");
  if (userId) {
    await notifyUser(
      userId,
      "Return update",
      `Your return request is now ${input.toStatus.replaceAll("_", " ")}.`,
      "order_return_requests",
      input.requestId,
      env
    );
  }

  return record;
}
